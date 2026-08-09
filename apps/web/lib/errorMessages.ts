/**
 * The backend throws `ApiError(status, CODE)` — the machine-readable CODE lands in
 * `response.data.message`, so raw strings like COUPON_NOT_FOUND would otherwise reach
 * users. Map codes to human copy here and surface everything through `friendlyError()`.
 */
const ERROR_COPY: Record<string, string> = {
  // ── Coupons ──────────────────────────────────────────────────────────────
  COUPON_NOT_FOUND: "This code is invalid or has expired.",
  COUPON_DELETED: "This code is invalid or has expired.",
  COUPON_INACTIVE: "This code is no longer active.",
  COUPON_NOT_STARTED: "This code isn't active yet. Check back soon.",
  COUPON_EXPIRED: "This code has expired.",
  COUPON_INVALID: "This code is invalid or has expired.",
  COUPON_USAGE_LIMIT_REACHED: "This code has reached its usage limit.",
  COUPON_USER_LIMIT_REACHED: "You've already used this code the maximum number of times.",
  MIN_ORDER_VALUE_NOT_MET: "Your order doesn't meet the minimum value for this code.",
  INVALID_COUPON_TYPE: "We couldn't apply this code. Please try another.",
  COUPON_IN_USE: "This code is currently in use. Please try again.",
  DUPLICATE_COUPON_CODE: "A coupon with this code already exists.",

  // ── Cart / stock ─────────────────────────────────────────────────────────
  CART_EMPTY: "Your cart is empty.",
  CART_HAS_INVALID_ITEMS: "Some items in your cart are no longer available.",
  STOCK_INSUFFICIENT: "Not enough stock for one or more items.",
  INVALID_QUANTITY: "Please choose a valid quantity.",
  PRODUCT_DELETED: "This product is no longer available.",
  VARIANT_DELETED: "This option is no longer available.",
  PRODUCT_NOT_FOUND: "This product is no longer available.",

  // ── Orders / checkout ────────────────────────────────────────────────────
  INVALID_ADDRESS: "Please select a valid delivery address.",
  PINCODE_NOT_SERVICEABLE: "Sorry, we don't deliver to this address's pincode yet. Please try a different address.",
  ORDER_AMOUNT_MISMATCH: "The order total changed. Please refresh and try again.",
  ORDER_NOT_FOUND: "We couldn't find that order.",
  ORDER_NOT_PENDING: "This order can no longer be changed.",
  ORDER_CANCELLED: "This order has been cancelled.",
  UNAUTHORIZED_ACCESS: "You don't have access to this order.",
  INVALID_STATUS_TRANSITION: "That action isn't allowed for this order right now.",
  CONCURRENCY_CONFLICT: "Something changed while you were checking out. Please try again.",
  IDEMPOTENCY_KEY_CONFLICT: "This request was already processed.",
  IDEMPOTENCY_KEY_REQUIRED: "Something went wrong. Please try again.",
  COD_NOT_AVAILABLE: "Cash on Delivery isn't available for this order.",
  COD_ALREADY_SET: "Cash on Delivery is already selected for this order.",

  // ── Payments ─────────────────────────────────────────────────────────────
  PAYMENT_METHOD_INVALID: "Please choose a valid payment method.",
  PAYMENT_FAILED: "Your payment didn't go through. Please try again.",
  PAYMENT_NOT_FOUND: "We couldn't find that payment.",
  PAYMENT_ALREADY_SUCCEEDED: "This payment has already been completed.",
  PAYMENT_MAX_ATTEMPTS: "Too many payment attempts. Please try again later.",
  PAYMENT_NOT_REFUNDABLE: "This payment can't be refunded.",
  INVALID_SIGNATURE: "We couldn't verify your payment. Please contact support.",
  AMOUNT_MISMATCH: "The payment amount didn't match. Please try again.",
  RAZORPAY_ORDER_CREATE_FAILED: "We couldn't start the payment. Please try again.",
  REFUND_FAILED: "The refund couldn't be processed. Please contact support.",
  REFUND_ALREADY_ISSUED: "A refund has already been issued for this order.",

  // ── Returns ──────────────────────────────────────────────────────────────
  RETURN_NOT_ELIGIBLE: "This order isn't eligible for a return.",
  RETURN_ALREADY_REQUESTED: "A return has already been requested for this order.",
  RETURN_ALREADY_RESOLVED: "This return has already been resolved.",
  RETURN_NOT_FOUND: "We couldn't find that return request.",

  // ── Pre-orders ───────────────────────────────────────────────────────────
  PREORDER_FULL: "All pre-order slots for this product are taken.",
  PREORDER_NOT_ENABLED: "Pre-orders aren't available for this product.",
  PREORDER_NOT_FOUND: "We couldn't find that pre-order.",
  OUT_OF_STOCK_AGAIN: "This item sold out before your payment completed. We'll refund your booking.",
  LINK_EXPIRED: "This link has expired.",
  BOOKING_EXCEEDS_TOTAL: "The booking amount is more than the order total.",

  // ── Affiliate ────────────────────────────────────────────────────────────
  ALREADY_AFFILIATE: "You're already an affiliate.",
  APPLICATION_PENDING: "Your application is still under review.",
  APPLICATION_REJECTED: "Your application was not approved.",
  AFFILIATE_NOT_APPROVED: "Your affiliate account isn't approved yet.",
  NOT_AN_AFFILIATE: "You're not registered as an affiliate.",
  SELF_REFERRAL: "You can't use your own referral link.",
  INVALID_REFERRAL_CODE: "That referral code isn't valid.",
  REFERRAL_CODE_TAKEN: "That referral code is already taken.",
  INSUFFICIENT_BALANCE: "You don't have enough balance to withdraw.",
  MINIMUM_WITHDRAWAL_NOT_MET: "You haven't reached the minimum withdrawal amount.",
  PAYOUT_DETAILS_MISSING: "Please add your payout details first.",

  // ── Generic ──────────────────────────────────────────────────────────────
  RATE_LIMIT_EXCEEDED: "Too many attempts. Please wait a moment and try again.",
  INVALID_TOKEN: "This link is invalid or has expired.",
}

/** True when a string looks like a raw backend code (SCREAMING_SNAKE_CASE). */
function looksLikeErrorCode(value: string): boolean {
  return /^[A-Z][A-Z0-9_]{3,}$/.test(value)
}

/**
 * Turn any thrown value (axios error, Error, string) into copy safe to show a user.
 * Known codes get mapped; unknown codes never leak — they fall back to `fallback`.
 */
export function friendlyError(err: unknown, fallback = "Something went wrong. Please try again."): string {
  const raw =
    (err as any)?.response?.data?.message ??
    (err as any)?.message ??
    (typeof err === "string" ? err : undefined)

  if (typeof raw !== "string" || !raw.trim()) return fallback
  if (ERROR_COPY[raw]) return ERROR_COPY[raw]
  // An unmapped code would look like gibberish to a shopper — hide it.
  if (looksLikeErrorCode(raw)) return fallback
  return raw
}
