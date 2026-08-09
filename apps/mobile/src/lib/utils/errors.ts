// Maps raw backend error codes to human-readable copy so users never see
// strings like "COUPON_NOT_FOUND" in a toast (client 4.5).

const FRIENDLY: Record<string, string> = {
  // Coupons (CouponErrorCode)
  COUPON_NOT_FOUND: "This code is invalid or has expired.",
  COUPON_DELETED: "This code is no longer available.",
  COUPON_INACTIVE: "This code isn't active right now.",
  COUPON_NOT_STARTED: "This code isn't active yet.",
  COUPON_EXPIRED: "This code has expired.",
  COUPON_USAGE_LIMIT_REACHED: "This code has reached its usage limit.",
  MIN_ORDER_VALUE_NOT_MET: "Your order doesn't meet this code's minimum value.",
  CART_HAS_INVALID_ITEMS: "Some items in your cart aren't eligible for this code.",
  INVALID_COUPON_TYPE: "This code can't be applied right now.",
  ORDER_AMOUNT_MISMATCH: "Your cart changed — please review and try again.",
  // Cart / stock
  CART_EMPTY: "Your cart is empty.",
  STOCK_INSUFFICIENT: "Not enough stock for one or more items.",
  MAX_QUANTITY_PER_ITEM: "You've reached the maximum quantity for this item.",
  // Generic
  UNAUTHORIZED_ACCESS: "Please sign in to continue.",
  INVALID_STATE: "That action isn't available right now.",
};

/** True for strings that look like a raw backend code (e.g. FOO_BAR_BAZ). */
function looksLikeCode(s: string): boolean {
  return /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/.test(s.trim());
}

/**
 * Extract a user-safe message from any thrown error (axios error, Error, string).
 * Known codes map to friendly copy; unknown raw-looking codes fall back to the
 * provided default rather than leaking the code.
 */
export function getErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  const raw =
    (err as any)?.response?.data?.message ??
    (err as any)?.response?.data?.error ??
    (err as any)?.message ??
    (typeof err === "string" ? err : undefined);

  if (!raw || typeof raw !== "string") return fallback;

  const key = raw.trim();
  if (FRIENDLY[key]) return FRIENDLY[key];
  // Unknown raw-looking code → never show it to the user.
  if (looksLikeCode(key)) return fallback;
  return key;
}
