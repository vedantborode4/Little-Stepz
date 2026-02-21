import { prisma } from "@repo/db/client";
import { ApiError } from "../utils/api";
import { PaymentErrorCode } from "../utils/paymentErrors";

const SHIPROCKET_API = "https://apiv2.shiprocket.in/v1/external";

// ─── Token cache (in-memory per process; tokens last 24h) ────────────────────
// No Redis needed — token is refreshed if expired or missing
let cachedToken:   string | null = null;
let tokenExpiresAt: number       = 0;

async function getShiprocketToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const email    = process.env.SHIPROCKET_EMAIL!;
  const password = process.env.SHIPROCKET_PASSWORD!;

  if (!email || !password) {
    throw new Error("SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD must be set");
  }

  const res = await fetch(`${SHIPROCKET_API}/auth/login`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new ApiError(502, PaymentErrorCode.SHIPROCKET_AUTH_FAILED);
  }

  const data = await res.json() as { token: string };

  cachedToken    = data.token;
  tokenExpiresAt = Date.now() + 23 * 60 * 60 * 1000; // 23h (tokens last 24h)

  return cachedToken;
}

async function shiprocketRequest<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path:   string,
  body?:  Record<string, unknown>
): Promise<T> {
  const token = await getShiprocketToken();

  const res = await fetch(`${SHIPROCKET_API}${path}`, {
    method,
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json() as any;

  if (!res.ok) {
    const msg = data?.message || "Shiprocket API error";
    throw new ApiError(502, msg);
  }

  return data as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ShiprocketCreateOrderPayload {
  order_id:          string;
  order_date:        string; // ISO date
  pickup_location:   string;
  channel_id?:       string;
  billing_customer_name:  string;
  billing_last_name?:     string;
  billing_address:        string;
  billing_city:           string;
  billing_pincode:        string;
  billing_state:          string;
  billing_country:        string;
  billing_email?:         string;
  billing_phone:          string;
  shipping_is_billing:    boolean;
  order_items: Array<{
    name:        string;
    sku:         string;
    units:       number;
    selling_price: number;
  }>;
  payment_method: "Prepaid" | "COD";
  sub_total:      number;
  length:         number; // cm
  breadth:        number;
  height:         number;
  weight:         number; // kg
}

export interface ShiprocketOrderResponse {
  order_id:    number;
  shipment_id: number;
  status:      string;
  awb_code?:   string;
  courier_name?: string;
  pickup_scheduled_date?: string;
  routing_code?: string;
}

export interface ShiprocketTrackingResponse {
  tracking_data: {
    track_status:      number;
    shipment_status:   string;
    shipment_track:    Array<{
      awb_code:         string;
      courier_name:     string;
      current_status:   string;
      current_timestamp: string;
      etd?:             string;
    }>;
    shipment_track_activities?: Array<{
      date:        string;
      status:      string;
      location:    string;
      activity:    string;
    }>;
  };
}

// ─── Create Shiprocket Order ──────────────────────────────────────────────────
export async function createShiprocketOrder(
  payload: ShiprocketCreateOrderPayload
): Promise<ShiprocketOrderResponse> {
  return shiprocketRequest<ShiprocketOrderResponse>(
    "POST",
    "/orders/create/adhoc",
    payload as unknown as Record<string, unknown>
  );
}

// ─── Track by AWB ─────────────────────────────────────────────────────────────
export async function trackShiprocketByAwb(
  awbCode: string
): Promise<ShiprocketTrackingResponse> {
  return shiprocketRequest<ShiprocketTrackingResponse>(
    "GET",
    `/courier/track/awb/${awbCode}`
  );
}

// ─── Cancel Shiprocket Order ──────────────────────────────────────────────────
export async function cancelShiprocketOrder(orderIds: number[]): Promise<void> {
  await shiprocketRequest("POST", "/orders/cancel", {
    ids: orderIds,
  });
}

// ─── Build Shiprocket payload from our Order ─────────────────────────────────
export function buildShiprocketPayload(params: {
  orderId:       string;
  orderDate:     Date;
  address:       {
    name:    string;
    phone:   string;
    address: string;
    city:    string;
    state:   string;
    pincode: string;
    country: string;
  };
  items: Array<{
    productId: string;
    name:      string;
    quantity:  number;
    price:     number;
    variantId?: string;
  }>;
  total:         number;
  paymentMethod: "ONLINE" | "COD";
}): ShiprocketCreateOrderPayload {
  const pickupLocation = process.env.SHIPROCKET_PICKUP_LOCATION ?? "Primary";

  return {
    order_id:          params.orderId.substring(0, 50),
    order_date:        params.orderDate.toISOString().split("T")[0]!,
    pickup_location:   pickupLocation,
    billing_customer_name: params.address.name,
    billing_address:   params.address.address,
    billing_city:      params.address.city,
    billing_pincode:   params.address.pincode,
    billing_state:     params.address.state,
    billing_country:   params.address.country,
    billing_phone:     params.address.phone,
    shipping_is_billing: true,
    order_items: params.items.map((item) => ({
      name:          item.name.substring(0, 100),
      sku:           item.variantId ?? item.productId,
      units:         item.quantity,
      selling_price: item.price,
    })),
    payment_method: params.paymentMethod === "COD" ? "COD" : "Prepaid",
    sub_total:      params.total,
    // Default dimensions — override via env or per-product metadata
    length:  Number(process.env.SHIPROCKET_PKG_LENGTH  ?? "20"),
    breadth: Number(process.env.SHIPROCKET_PKG_BREADTH ?? "15"),
    height:  Number(process.env.SHIPROCKET_PKG_HEIGHT  ?? "10"),
    weight:  Number(process.env.SHIPROCKET_PKG_WEIGHT  ?? "0.5"),
  };
}
