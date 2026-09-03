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
  COUPON_USER_LIMIT_REACHED: "You've already used this code the maximum number of times.",
  MIN_ORDER_VALUE_NOT_MET: "Your order doesn't meet this code's minimum value.",
  CART_HAS_INVALID_ITEMS: "Some items in your cart aren't eligible for this code.",
  INVALID_COUPON_TYPE: "This code can't be applied right now.",
  ORDER_AMOUNT_MISMATCH: "Your cart changed — please review and try again.",
  // Cart / stock
  CART_EMPTY: "Your cart is empty.",
  STOCK_INSUFFICIENT: "Not enough stock for one or more items.",
  MAX_QUANTITY_PER_ITEM: "You've reached the maximum quantity for this item.",
  // Phone verification
  PHONE_NOT_VERIFIED: "Please verify this phone number before saving.",
  PHONE_ALREADY_VERIFIED: "This number is already verified.",
  OTP_INVALID: "That code isn't right. Check it and try again.",
  OTP_EXPIRED: "That code has expired. Request a new one.",
  OTP_MAX_ATTEMPTS: "Too many incorrect attempts. Request a new code.",
  OTP_COOLDOWN: "We just sent a code — check your messages, or wait a moment to resend.",
  // Shared by the email-signup and phone flows — keep this channel-neutral.
  OTP_SEND_LIMIT: "Too many codes requested. Please try again later.",
  OTP_DAILY_LIMIT: "Daily verification limit reached. Please try again tomorrow.",
  OTP_RATE_LIMITED: "Too many attempts. Please wait a moment and try again.",
  SMS_SEND_FAILED: "We couldn't send the code. Check the number and try again.",
  // Signup / email verification
  EMAIL_ALREADY_REGISTERED: "An account with this email already exists. Sign in instead.",
  EMAIL_SEND_FAILED: "We couldn't send the verification email. Check the address and try again.",
  OTP_RESEND_TOO_SOON: "We just sent a code — check your inbox, or wait a moment to resend.",
  APP_UPDATE_REQUIRED: "Please update the app to create an account.",
  // Partial payment (20% deposit / balance on delivery)
  PARTIAL_PAYMENT_DISABLED: "Pay-later isn't available right now.",
  PARTIAL_PAYMENT_NOT_ELIGIBLE: "Pay-later is no longer available for this order.",
  PARTIAL_NOT_ELIGIBLE: "Some items in your cart can't be paid in instalments.",
  PARTIAL_ORDER_VALUE_EXCEEDED: "This order is above the pay-later limit.",
  PARTIAL_LIMIT_REACHED: "You already have orders with a balance due. Pay one off to use this again.",
  PARTIAL_AMOUNT_TOO_SMALL: "This order is too small to split into two payments.",
  FORFEIT_TERMS_NOT_ACCEPTED: "Please confirm you understand the deposit is non-refundable.",
  DEPOSIT_FORFEIT_CONFIRMATION_REQUIRED:
    "Cancelling forfeits your deposit — please confirm to continue.",
  COD_NOT_AVAILABLE: "Our courier can't collect payment at this address.",
  PINCODE_NOT_SERVICEABLE: "We don't deliver to this pincode yet.",
  BALANCE_ALREADY_SETTLED: "This balance has already been paid.",
  BALANCE_NOT_DUE: "There's no balance outstanding on this order.",
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
