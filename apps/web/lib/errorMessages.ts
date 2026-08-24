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
  COD_NOT_AVAILABLE: "Cash on Delivery is no longer offered. Please pay online to complete your order.",
  COD_ALREADY_SET: "Cash on Delivery is no longer offered. Please pay online to complete your order.",

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

  // ── Shipping / Delhivery (admin-facing) ──────────────────────────────────
  DELHIVERY_ORDER_FAILED: "Delhivery rejected this shipment. Check Shipping settings and the server logs for the reason.",
  DELHIVERY_AUTH_FAILED: "Delhivery rejected our credentials. Check DELHIVERY_API_TOKEN.",
  DELHIVERY_WAREHOUSE_CREATE_FAILED: "Delhivery wouldn't register the pickup warehouse. Check the warehouse details and the server logs.",
  SHIPMENT_NOT_FOUND: "We couldn't find a shipment for this order.",
  SHIPMENT_ALREADY_EXISTS: "This order has already been handed to the courier.",

  // ── Phone verification ───────────────────────────────────────────────────
  PHONE_NOT_VERIFIED: "Please verify this phone number before saving.",
  PHONE_ALREADY_VERIFIED: "This number is already verified.",
  OTP_INVALID: "That code isn't right. Check it and try again.",
  OTP_EXPIRED: "That code has expired. Request a new one.",
  OTP_MAX_ATTEMPTS: "Too many incorrect attempts. Request a new code.",
  OTP_COOLDOWN: "We just sent a code — check your messages, or wait a moment to resend.",
  // Shared by the email-signup and phone flows — keep the wording channel-neutral.
  OTP_SEND_LIMIT: "Too many codes requested. Please try again later.",
  OTP_DAILY_LIMIT: "Daily verification limit reached. Please try again tomorrow.",
  OTP_RATE_LIMITED: "Too many attempts. Please wait a moment and try again.",
  SMS_SEND_FAILED: "We couldn't send the code. Check the number and try again.",

  // ── Signup / email verification ──────────────────────────────────────────
  EMAIL_ALREADY_REGISTERED: "An account with this email already exists. Sign in instead.",
  EMAIL_SEND_FAILED: "We couldn't send the verification email. Check the address and try again.",
  OTP_RESEND_TOO_SOON: "We just sent a code — check your inbox, or wait a moment to resend.",
  APP_UPDATE_REQUIRED: "Please update the app to create an account.",

  // ── Generic ──────────────────────────────────────────────────────────────
  RATE_LIMIT_EXCEEDED: "Too many attempts. Please wait a moment and try again.",
  INVALID_TOKEN: "This link is invalid or has expired.",
}

/**
 * Some backend errors carry the upstream reason after the code
 * (`DELHIVERY_ORDER_FAILED: ClientWarehouse matching query does not exist.; true`).
 * The courier's wording is precise but unreadable, and it names the fix badly — so
 * match on the remark and say what to actually do about it.
 */
const REMARK_COPY: { match: RegExp; copy: string }[] = [
  {
    match: /clientwarehouse matching query does not exist/i,
    copy:
      "The pickup warehouse isn't registered with Delhivery. Open Shipping settings and register it, " +
      "or correct DELHIVERY_PICKUP_NAME to match the name in the Delhivery panel exactly.",
  },
  {
    match: /not serviceable for cod/i,
    copy: "Delhivery doesn't deliver to this pincode.",
  },
  {
    match: /not serviceable|pin(code)? not/i,
    copy: "Delhivery doesn't deliver to this pincode.",
  },
]

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

  // Codes can arrive with the upstream reason appended — `CODE: courier remark` or
  // `CODE (HTTP 502)`. Neither matched anything before, so the whole raw string was
  // rendered verbatim (this is what put "ClientWarehouse matching query does not
  // exist.; true" in front of an admin). The remark is more specific than the code,
  // so try it first, then the code's own copy, and never fall through to raw.
  const prefixed = raw.match(/^([A-Z][A-Z0-9_]{3,})\b([\s\S]*)$/)

  if (prefixed) {
    const code = prefixed[1]!
    const detail = prefixed[2]!.replace(/^[:\s]+/, "").trim()

    const remark = detail ? REMARK_COPY.find((r) => r.match.test(detail)) : undefined
    if (remark) return remark.copy

    return ERROR_COPY[code] ?? fallback
  }

  // An unmapped code would look like gibberish to a shopper — hide it.
  if (looksLikeErrorCode(raw)) return fallback
  return raw
}
