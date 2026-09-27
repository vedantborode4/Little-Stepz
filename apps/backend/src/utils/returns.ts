import { Decimal } from "decimal.js";
import type { ReturnStatus } from "@repo/db/client";

/**
 * Item-level returns: config, the return window, and the pure refund arithmetic.
 *
 * Nothing here touches the database, so the money rules can be reasoned about (and
 * exercised) in isolation from the services that apply them.
 */

export const RETURN_WINDOW_DAYS = 7;

/** Kill switch. Off, the legacy whole-order return flow behaves exactly as before. */
export function itemReturnsEnabled(): boolean {
  return process.env.ITEM_RETURNS_ENABLED === "true";
}

/** Delhivery reverse pickup is a backup channel, off until proven on the account. */
export function reversePickupEnabled(): boolean {
  return process.env.DELHIVERY_RVP_ENABLED === "true";
}

/** Returns that still hold their units — a unit in any of these cannot be requested again. */
export const QUANTITY_HOLDING_STATUSES: ReturnStatus[] = [
  "PENDING",
  "APPROVED",
  "PICKED_UP",
  "RECEIVED",
  "REFUNDED",
  "INSPECTION_FAILED",
];

/** Returns the customer or an admin is still working through. */
export const OPEN_RETURN_STATUSES: ReturnStatus[] = ["PENDING", "APPROVED", "PICKED_UP"];

/** Returns whose goods have been inspected, i.e. whose accepted units are final. */
export const RECEIVED_RETURN_STATUSES: ReturnStatus[] = ["RECEIVED", "REFUNDED"];

export const MIN_GATEWAY_REFUND = 1;

const round2 = (d: Decimal) => d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

/**
 * When the goods reached the customer.
 *
 * The courier's delivery timestamp, not `order.updatedAt` — that bumps on any write, so
 * an admin touching the order would silently restart the window. Falls back to
 * `updatedAt` only for orders marked delivered by hand, which have no courier scan.
 */
export function resolveDeliveredAt(order: {
  updatedAt: Date;
  shipments: Array<{ deliveredAt: Date | null }>;
}): Date {
  return order.shipments.find((s) => s.deliveredAt)?.deliveredAt ?? order.updatedAt;
}

export function returnWindowEnd(deliveredAt: Date): Date {
  const end = new Date(deliveredAt);
  end.setDate(end.getDate() + RETURN_WINDOW_DAYS);
  return end;
}

/**
 * What each order line is worth after the coupon — `(total − shipping)` spread across
 * lines in proportion to `price × qty`, the last line absorbing rounding.
 *
 * This is the same apportioning the tax invoice uses (`computeTax` in utils/invoice.ts),
 * so a refund lines up with the invoice line it reverses. Lines are sorted by id so the
 * "last line" is stable no matter what order the rows are read in.
 */
export function allocateLineNet(
  order: { total: Decimal.Value; shippingCharges: Decimal.Value },
  items: Array<{ id: string; price: Decimal.Value; quantity: number }>
): Map<string, Decimal> {
  const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));
  const itemsNet = Decimal.max(new Decimal(order.total).minus(order.shippingCharges), 0);
  const gross = sorted.map((i) => new Decimal(i.price).mul(i.quantity));
  const grossTotal = gross.reduce((s, g) => s.plus(g), new Decimal(0));

  const result = new Map<string, Decimal>();
  let allocated = new Decimal(0);
  sorted.forEach((item, idx) => {
    const isLast = idx === sorted.length - 1;
    const share = isLast
      ? itemsNet.minus(allocated)
      : grossTotal.gt(0)
        ? round2(gross[idx]!.mul(itemsNet).div(grossTotal))
        : new Decimal(0);
    allocated = allocated.plus(share);
    result.set(item.id, share);
  });
  return result;
}

/**
 * The value of `units` more units of a line, given `before` units already refunded.
 *
 * Computed cumulatively — round(value at before+units) − round(value at before) — so
 * however a line is split across returns, the refunds telescope to exactly its net
 * value. No return ever needs to "absorb the remainder".
 */
export function unitsValue(lineNet: Decimal, quantity: number, before: number, units: number): Decimal {
  if (quantity <= 0 || units <= 0) return new Decimal(0);
  const at = (n: number) => round2(lineNet.mul(n).div(quantity));
  return at(before + units).minus(at(before));
}

/**
 * Was any of this order's money paid by a channel no gateway can reverse? Then a refund
 * (or part of one) is a manual payout, and the customer must tell us where to send it.
 */
export function needsManualRefund(order: {
  paymentMethod: string;
  payment: {
    method: string;
    razorpayPaymentId: string | null;
    balanceSettledAt: Date | null;
    balanceRazorpayPaymentId: string | null;
  } | null;
}): boolean {
  if (order.paymentMethod === "COD" || order.payment?.method === "COD") return true;
  const p = order.payment;
  if (!p) return false;
  return Boolean(p.balanceSettledAt && !p.balanceRazorpayPaymentId);
}

export function maskUpi(upi: string | null | undefined): string | null {
  if (!upi) return null;
  const [name = "", handle = ""] = upi.split("@");
  const visible = name.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(name.length - 2, 2))}@${handle}`;
}

export { round2 };
