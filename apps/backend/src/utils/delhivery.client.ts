import { ApiError } from "../utils/api";
import { PaymentErrorCode } from "../utils/paymentErrors";
import type { ShipmentStatus } from "@repo/db/client";

// Delhivery B2C ("One") API. Token-header auth — no login/refresh flow like Shiprocket had.
const DELHIVERY_API = process.env.DELHIVERY_BASE_URL ?? "https://track.delhivery.com";

function getToken(): string {
  const token = process.env.DELHIVERY_API_TOKEN;
  if (!token) throw new ApiError(502, PaymentErrorCode.DELHIVERY_AUTH_FAILED);
  return token;
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    Authorization: `Token ${getToken()}`,
    Accept: "application/json",
    ...extra,
  };
}

// ─── Config helpers (env-driven package defaults) ────────────────────────────
export function getDefaultPackageWeightGrams(): number {
  return Number(process.env.DELHIVERY_PKG_WEIGHT ?? "500");
}

export function getOriginPincode(): string | undefined {
  return process.env.DELHIVERY_ORIGIN_PINCODE;
}

// ─── Serviceability / pincode check ──────────────────────────────────────────
export interface ServiceabilityResult {
  serviceable: boolean;
  prepaid: boolean;
  cod: boolean;
  pickup: boolean;
}

export async function checkServiceability(pincode: string): Promise<ServiceabilityResult> {
  const url = `${DELHIVERY_API}/c/api/pin-codes/json/?filter_codes=${encodeURIComponent(pincode)}`;
  const res = await fetch(url, { headers: authHeaders() });

  if (!res.ok) throw new ApiError(502, "Delhivery serviceability check failed");

  const data = (await res.json()) as any;
  const entry = data?.delivery_codes?.[0]?.postal_code;

  if (!entry) {
    return { serviceable: false, prepaid: false, cod: false, pickup: false };
  }

  const yes = (v: unknown) => v === "Y" || v === true || v === "true";
  return {
    serviceable: true,
    prepaid: yes(entry.pre_paid),
    cod: yes(entry.cod) || yes(entry.cash),
    pickup: yes(entry.pickup),
  };
}

// ─── Shipping rate ────────────────────────────────────────────────────────────
export async function getShippingRate(params: {
  originPin: string;
  destPin: string;
  weightGrams: number;
  paymentMode: "Pre-paid" | "COD";
}): Promise<number> {
  const q = new URLSearchParams({
    md: "S", // Surface (E = Express)
    ss: "Delivered",
    o_pin: params.originPin,
    d_pin: params.destPin,
    cgm: String(params.weightGrams),
    pt: params.paymentMode,
  });

  const url = `${DELHIVERY_API}/api/kinko/v1/invoice/charges/.json?${q.toString()}`;
  const res = await fetch(url, { headers: authHeaders() });

  if (!res.ok) throw new ApiError(502, "Delhivery rate calculation failed");

  const data = (await res.json()) as any;
  const first = Array.isArray(data) ? data[0] : data;
  const amount = Number(first?.total_amount ?? first?.charge_DL);

  if (!Number.isFinite(amount)) throw new ApiError(502, "Delhivery rate response malformed");
  return amount;
}

// ─── Create shipment (manifest) ──────────────────────────────────────────────
export interface DelhiveryShipmentInput {
  order: string;
  name: string;
  add: string;
  city: string;
  state: string;
  country: string;
  pin: string;
  phone: string;
  paymentMode: "Prepaid" | "COD";
  codAmount: number;
  totalAmount: number;
  productsDesc: string;
  quantity: number;
  weightGrams?: number;
  length?: number;
  breadth?: number;
  height?: number;
}

export interface DelhiveryCreateResult {
  waybill: string;
  refnum: string;
  status: string;
  raw: unknown;
}

export async function createDelhiveryShipment(
  input: DelhiveryShipmentInput
): Promise<DelhiveryCreateResult> {
  const pickupName = process.env.DELHIVERY_PICKUP_NAME;
  if (!pickupName) throw new ApiError(500, "DELHIVERY_PICKUP_NAME not configured");

  const length = input.length ?? Number(process.env.DELHIVERY_PKG_LENGTH ?? "20");
  const width = input.breadth ?? Number(process.env.DELHIVERY_PKG_BREADTH ?? "15");
  const height = input.height ?? Number(process.env.DELHIVERY_PKG_HEIGHT ?? "10");
  const weight = input.weightGrams ?? getDefaultPackageWeightGrams();

  const payload = {
    shipments: [
      {
        name: input.name,
        add: input.add,
        pin: input.pin,
        city: input.city,
        state: input.state,
        country: input.country,
        phone: input.phone,
        order: input.order,
        payment_mode: input.paymentMode,
        cod_amount: input.paymentMode === "COD" ? String(input.codAmount) : "0",
        total_amount: String(input.totalAmount),
        products_desc: input.productsDesc.substring(0, 200),
        quantity: String(input.quantity),
        weight: String(weight),
        shipment_length: String(length),
        shipment_width: String(width),
        shipment_height: String(height),
      },
    ],
    pickup_location: { name: pickupName },
  };

  // Delhivery expects form-urlencoded `format=json&data=<json>`, not a raw JSON body.
  const body = `format=json&data=${encodeURIComponent(JSON.stringify(payload))}`;

  const res = await fetch(`${DELHIVERY_API}/api/cmu/create.json`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/x-www-form-urlencoded" }),
    body,
  });

  const data = (await res.json().catch(() => ({}))) as any;
  const pkg = data?.packages?.[0];

  // Delhivery often returns 200 with packages[].status === "Fail" on rejection.
  const ok =
    res.ok &&
    data?.success !== false &&
    pkg?.waybill &&
    !/fail/i.test(String(pkg?.status ?? ""));

  if (!ok) {
    // Delhivery puts the actual reason in packages[].remarks (e.g. "ClientWarehouse
    // matching query does not exist", "pin not serviceable for COD"). Throwing a
    // bare error code discarded it, leaving an operator staring at
    // DELHIVERY_ORDER_FAILED with no way to tell a warehouse misconfiguration from
    // an unserviceable pincode. Log the whole body and put the reason in the message.
    const remarks = [
      ...(Array.isArray(pkg?.remarks) ? pkg.remarks : [pkg?.remarks]),
      data?.rmk,
      data?.error,
    ]
      .filter(Boolean)
      .map(String)
      .join("; ");

    console.error("[delhivery] create failed", {
      httpStatus: res.status,
      order: input.order,
      paymentMode: input.paymentMode,
      pin: input.pin,
      response: data,
    });

    throw new ApiError(
      502,
      remarks
        ? `${PaymentErrorCode.DELHIVERY_ORDER_FAILED}: ${remarks}`
        : `${PaymentErrorCode.DELHIVERY_ORDER_FAILED} (HTTP ${res.status})`
    );
  }

  return {
    waybill: String(pkg.waybill),
    refnum: String(pkg.refnum ?? input.order),
    status: String(pkg.status ?? "Success"),
    raw: data,
  };
}

// ─── Track by waybill ─────────────────────────────────────────────────────────
export interface DelhiveryTrackResult {
  status: string;
  statusType: string;
  statusLocation: string;
  statusDateTime: string | null;
  instructions: string;
  expectedDate: string | null;
  deliveredDate: string | null;
  raw: unknown;
}

export async function trackByWaybill(waybill: string): Promise<DelhiveryTrackResult> {
  const url = `${DELHIVERY_API}/api/v1/packages/json/?waybill=${encodeURIComponent(waybill)}`;
  const res = await fetch(url, { headers: authHeaders() });

  if (!res.ok) throw new ApiError(502, "Delhivery tracking failed");

  const data = (await res.json()) as any;
  const shipment = data?.ShipmentData?.[0]?.Shipment;

  if (!shipment) throw new ApiError(404, PaymentErrorCode.SHIPMENT_NOT_FOUND);

  const st = shipment.Status ?? {};
  const delivered =
    String(st.StatusType).toUpperCase() === "DL" || /delivered/i.test(String(st.Status ?? ""));

  return {
    status: String(st.Status ?? ""),
    statusType: String(st.StatusType ?? ""),
    statusLocation: String(st.StatusLocation ?? ""),
    statusDateTime: st.StatusDateTime ?? null,
    instructions: String(st.Instructions ?? ""),
    expectedDate: shipment.ExpectedDeliveryDate ?? null,
    deliveredDate: delivered ? (st.StatusDateTime ?? null) : null,
    raw: data,
  };
}

// ─── Cancel shipment ──────────────────────────────────────────────────────────
export async function cancelDelhiveryShipment(waybill: string): Promise<void> {
  const res = await fetch(`${DELHIVERY_API}/api/p/edit`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ waybill, cancellation: "true" }),
  });

  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || data?.status === false) {
    throw new ApiError(502, "Delhivery cancellation failed");
  }
}

// ─── Map Delhivery status → our provider-neutral ShipmentStatus ───────────────
export function mapDelhiveryStatus(status: string, statusType: string): ShipmentStatus {
  const s = (status ?? "").toLowerCase();
  const t = (statusType ?? "").toUpperCase();

  // RTO is checked BEFORE delivered, and StatusType before free text. Delhivery
  // reports a returned parcel arriving back at origin as "RTO Delivered" (and
  // "DTO Delivered"), which the old delivered-first order matched as a successful
  // customer delivery — marking the order DELIVERED, settling COD as collected for
  // cash nobody paid, paying affiliate commission and telling the customer their
  // parcel had arrived.
  if (t === "RT") return "RETURNED";
  if (t === "DL") return "DELIVERED";
  if (s.includes("rto") || s.includes("return")) return "RETURNED";
  if (s.includes("delivered")) return "DELIVERED";
  if (s.includes("cancel") || s.includes("lost") || s.includes("damaged")) return "FAILED";
  if (s.includes("out for delivery") || s.includes("dispatched")) return "OUT_FOR_DELIVERY";
  if (s.includes("manifest") || s.includes("pending") || s.includes("not picked")) return "PROCESSING";
  if (s.includes("in transit") || t === "UD") return "IN_TRANSIT";
  return "IN_TRANSIT";
}
