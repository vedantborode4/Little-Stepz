/** Human-friendly short order reference, e.g. "3F9A2B7C". */
export function orderShortRef(orderId: string): string {
  return orderId.slice(-8).toUpperCase();
}

/** Formats an amount as ₹ with Indian grouping. */
export function money(amount: number | string): string {
  return `₹${Number(amount).toLocaleString("en-IN")}`;
}

import type { NotificationType, OrderStatus } from "@repo/db/client";

/**
 * Maps a customer-facing order status to a notification. Returns null for
 * statuses that don't warrant (or are notified through a more specific path,
 * e.g. payment/refund). Keyed by the string enum value.
 */
export function orderStatusNotification(
  status: OrderStatus,
  orderId: string
): { type: NotificationType; title: string; body: string } | null {
  const ref = orderShortRef(orderId);
  switch (status) {
    case "CONFIRMED":
      return {
        type: "ORDER_CONFIRMED",
        title: "Order confirmed ✅",
        body: `Your order #${ref} is confirmed and being prepared.`,
      };
    case "PROCESSING":
      return {
        type: "ORDER_PROCESSING",
        title: "Order is being packed 📦",
        body: `We're getting order #${ref} ready to ship.`,
      };
    case "SHIPPED":
      return {
        type: "ORDER_SHIPPED",
        title: "Order shipped 🚚",
        body: `Your order #${ref} is on its way.`,
      };
    case "OUT_FOR_DELIVERY":
      return {
        type: "ORDER_OUT_FOR_DELIVERY",
        title: "Out for delivery 🛵",
        body: `Your order #${ref} is out for delivery today.`,
      };
    case "DELIVERED":
      return {
        type: "ORDER_DELIVERED",
        title: "Delivered 🎉",
        body: `Your order #${ref} has been delivered. Enjoy!`,
      };
    case "CANCELLED":
      return {
        type: "ORDER_CANCELLED",
        title: "Order cancelled",
        body: `Your order #${ref} has been cancelled.`,
      };
    default:
      return null;
  }
}
