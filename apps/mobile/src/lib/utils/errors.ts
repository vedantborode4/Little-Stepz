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
  // Cash on Delivery
  COD_ALREADY_SET: "This order is already set to Cash on Delivery.",
  COD_DISABLED: "Cash on Delivery isn't available right now.",
  COD_NOT_ELIGIBLE: "Some items in your cart can't be paid with Cash on Delivery.",
  COD_ORDER_VALUE_EXCEEDED: "This order is above the Cash on Delivery limit. Please pay online.",
  COD_LIMIT_REACHED: "You already have Cash on Delivery orders on the way. Please pay online for this one.",
  COD_BLOCKED: "Cash on Delivery isn't available on this account. You can still pay online.",
  COD_PLAN_CONFLICT: "Cash on Delivery can't be combined with a deposit. Please choose one.",
  PINCODE_NOT_SERVICEABLE: "We don't deliver to this pincode yet.",
  BALANCE_ALREADY_SETTLED: "This balance has already been paid.",
  BALANCE_NOT_DUE: "There's no balance outstanding on this order.",
  BALANCE_UNSETTLED: "Collect or settle the balance before marking this order delivered.",
  BALANCE_LINK_DISPATCHED: "This order has been handed to the courier — the balance will be collected at delivery.",
  BALANCE_LINK_INVALID: "This payment link is no longer valid.",
  CANCELLATION_PARTY_REQUIRED: "Choose who is cancelling — it decides whether the deposit is refunded.",
  // Orders
  PRODUCT_DELETED: "An item in your order is no longer available.",
  VARIANT_DELETED: "An option you chose is no longer available.",
  INVALID_QUANTITY: "Please choose a valid quantity.",
  INVALID_ADDRESS: "Please choose a valid delivery address.",
  COUPON_INVALID: "This code can't be applied to your order.",
  ORDER_NOT_FOUND: "We couldn't find that order.",
  INVALID_STATUS_TRANSITION: "The order can't be moved to that status from where it is now.",
  IDEMPOTENCY_KEY_CONFLICT: "Your cart changed while placing the order — please try again.",
  IDEMPOTENCY_KEY_REQUIRED: "Something went wrong placing your order. Please try again.",
  PAYMENT_METHOD_INVALID: "That payment method isn't available for this order.",
  CONCURRENCY_CONFLICT: "Someone else just updated this — please refresh and try again.",
  RATE_LIMIT_EXCEEDED: "Too many attempts. Please wait a minute and try again.",
  SHIPMENT_ACTIVE: "Cancel the courier shipment before changing how this order is delivered.",
  // Payments
  ORDER_NOT_PENDING: "This order can no longer be paid for or changed.",
  PAYMENT_ALREADY_EXISTS: "A payment has already been started for this order.",
  PAYMENT_ALREADY_SUCCEEDED: "This order has already been paid.",
  PAYMENT_NOT_FOUND: "We couldn't find the payment for this order.",
  PAYMENT_MAX_ATTEMPTS: "Too many payment attempts on this order. Please place a new order.",
  RAZORPAY_ORDER_CREATE_FAILED: "We couldn't start the payment. Please try again.",
  RAZORPAY_ORDER_ID_MISMATCH: "Payment verification failed. If money was deducted, it will be refunded.",
  INVALID_SIGNATURE: "Payment verification failed. If money was deducted, it will be refunded.",
  AMOUNT_MISMATCH: "The payment amount didn't match. If money was deducted, it will be refunded.",
  ORDER_IS_MANUAL_FULFILMENT: "This order is set for local delivery, so it can't be shipped by courier.",
  // Returns & refunds
  RETURN_ALREADY_REQUESTED: "A return has already been requested for this order.",
  RETURN_NOT_ELIGIBLE: "This order isn't eligible for a return.",
  RETURN_NOT_FOUND: "We couldn't find that return request.",
  RETURN_ALREADY_RESOLVED: "This return has already been resolved.",
  REFUND_FAILED: "The refund couldn't be processed. Please try again.",
  REFUND_ALREADY_ISSUED: "A refund has already been issued.",
  PAYMENT_NOT_REFUNDABLE: "This payment can't be refunded online.",
  // Shipping
  SHIPMENT_NOT_FOUND: "No shipment found for this order.",
  DELHIVERY_AUTH_FAILED: "The courier service is unavailable right now. Please try again later.",
  DELHIVERY_ORDER_FAILED: "The courier couldn't create this shipment. Please try again.",
  // Invoices & receipts
  INVOICE_NOT_AVAILABLE: "The invoice isn't ready yet.",
  INVOICE_NUMBER_FAILED: "We couldn't generate the invoice. Please try again.",
  RECEIPT_NOT_AVAILABLE: "There's no receipt for this order yet.",
  // Pre-orders
  PRODUCT_NOT_FOUND: "This product is no longer available.",
  PREORDER_NOT_ENABLED: "Pre-orders aren't open for this product.",
  PRODUCT_AVAILABLE: "This product is in stock — you can buy it now instead.",
  PREORDER_FULL: "Pre-orders for this product are full.",
  BOOKING_EXCEEDS_TOTAL: "The booking amount can't be more than the price.",
  VARIANT_INVALID: "Please choose a valid option.",
  PREORDER_NOT_FOUND: "We couldn't find that pre-order.",
  LINK_EXPIRED: "This payment link has expired.",
  OUT_OF_STOCK_AGAIN: "Sorry, this item has sold out again.",
  // Affiliates
  ALREADY_AFFILIATE: "You're already an affiliate.",
  APPLICATION_PENDING: "Your application is already under review.",
  APPLICATION_REJECTED: "Your affiliate application wasn't approved.",
  NOT_AN_AFFILIATE: "You're not registered as an affiliate yet.",
  AFFILIATE_NOT_APPROVED: "Your affiliate account isn't approved yet.",
  AFFILIATE_NOT_FOUND: "We couldn't find that affiliate.",
  INVALID_REFERRAL_CODE: "That referral code isn't valid.",
  SELF_REFERRAL: "You can't use your own referral code.",
  REFERRAL_CODE_TAKEN: "That referral code is already taken.",
  COMMISSION_NOT_FOUND: "We couldn't find that commission.",
  DOUBLE_COMMISSION: "A commission has already been recorded for this order.",
  COMMISSION_ALREADY_PAID: "This commission has already been paid.",
  INELIGIBLE_FOR_COMMISSION: "This order isn't eligible for a commission.",
  INSUFFICIENT_BALANCE: "You don't have enough available balance for that amount.",
  PAYOUT_DETAILS_MISSING: "Add your bank details before requesting a withdrawal.",
  WITHDRAWAL_NOT_FOUND: "We couldn't find that withdrawal.",
  WITHDRAWAL_ALREADY_PROCESSED: "This withdrawal has already been processed.",
  MINIMUM_WITHDRAWAL_NOT_MET: "That's below the minimum withdrawal amount.",
  CLICK_RATE_LIMITED: "Too many requests. Please try again shortly.",
  // Coupons (admin)
  INVALID_VALUE: "Enter a valid discount value.",
  INVALID_DATE_RANGE: "The end date must be after the start date.",
  USAGE_LIMIT_TOO_LOW: "The usage limit can't be lower than the times it's already been used.",
  DUPLICATE_COUPON_CODE: "A coupon with this code already exists.",
  COUPON_IN_USE: "This coupon has been used, so it can't be deleted — deactivate it instead.",
  OPTIMISTIC_LOCK_FAILED: "This coupon was changed by someone else — refresh and try again.",
  // Notifications (admin)
  NOTIFICATION_NOT_FOUND: "That notification no longer exists.",
  BROADCAST_TARGET_NOT_FOUND: "No customers match that audience.",
  NO_RECIPIENTS: "There's nobody to send this to yet.",
  // Account
  CUSTOMER_NOT_FOUND: "We couldn't find that customer.",
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
