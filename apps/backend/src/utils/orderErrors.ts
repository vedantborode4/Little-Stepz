export enum OrderErrorCode {
  CART_EMPTY = "CART_EMPTY",
  CART_HAS_INVALID_ITEMS = "CART_HAS_INVALID_ITEMS",
  STOCK_INSUFFICIENT = "STOCK_INSUFFICIENT",
  PRODUCT_DELETED = "PRODUCT_DELETED",
  VARIANT_DELETED = "VARIANT_DELETED",
  INVALID_QUANTITY = "INVALID_QUANTITY",
  INVALID_ADDRESS = "INVALID_ADDRESS",
  COUPON_INVALID = "COUPON_INVALID", // Generic for various coupon issues
  COUPON_EXPIRED = "COUPON_EXPIRED",
  COUPON_USAGE_LIMIT_REACHED = "COUPON_USAGE_LIMIT_REACHED",
  MIN_ORDER_VALUE_NOT_MET = "MIN_ORDER_VALUE_NOT_MET",
  ORDER_AMOUNT_MISMATCH = "ORDER_AMOUNT_MISMATCH",
  ORDER_NOT_FOUND = "ORDER_NOT_FOUND",
  UNAUTHORIZED_ACCESS = "UNAUTHORIZED_ACCESS",
  INVALID_STATUS_TRANSITION = "INVALID_STATUS_TRANSITION",
  IDEMPOTENCY_KEY_CONFLICT = "IDEMPOTENCY_KEY_CONFLICT",
  IDEMPOTENCY_KEY_REQUIRED = "IDEMPOTENCY_KEY_REQUIRED",
  PAYMENT_METHOD_INVALID = "PAYMENT_METHOD_INVALID",
  CONCURRENCY_CONFLICT = "CONCURRENCY_CONFLICT",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",

  // Partial payment (20% deposit / balance at delivery).
  // Every one of these must be mapped in web's `friendlyError` and mobile's
  // `getErrorMessage` — an unmapped SCREAMING_SNAKE code is rendered to the customer.
  /** A cart line's product or variant does not allow partial payment. */
  PARTIAL_NOT_ELIGIBLE = "PARTIAL_NOT_ELIGIBLE",
  /** Order value is above PARTIAL_MAX_ORDER_VALUE. */
  PARTIAL_ORDER_VALUE_EXCEEDED = "PARTIAL_ORDER_VALUE_EXCEEDED",
  /** Customer already holds PARTIAL_MAX_OPEN_ORDERS orders with an unpaid balance. */
  PARTIAL_LIMIT_REACHED = "PARTIAL_LIMIT_REACHED",
  /** Eligibility lapsed between the quote and order creation. */
  PARTIAL_PAYMENT_NOT_ELIGIBLE = "PARTIAL_PAYMENT_NOT_ELIGIBLE",
  /** Partial payment is turned off store-wide. */
  PARTIAL_PAYMENT_DISABLED = "PARTIAL_PAYMENT_DISABLED",
  /** The total cannot be split into two legs Razorpay will accept. */
  PARTIAL_AMOUNT_TOO_SMALL = "PARTIAL_AMOUNT_TOO_SMALL",
  /** The forfeiture terms were not acknowledged. */
  FORFEIT_TERMS_NOT_ACCEPTED = "FORFEIT_TERMS_NOT_ACCEPTED",
  /** Cancelling a deposit-paid order needs explicit confirmation that it is forfeited. */
  DEPOSIT_FORFEIT_CONFIRMATION_REQUIRED = "DEPOSIT_FORFEIT_CONFIRMATION_REQUIRED",
  /** Admin cancel of a partial order must say who initiated it. */
  CANCELLATION_PARTY_REQUIRED = "CANCELLATION_PARTY_REQUIRED",

  /** Cannot deliver a partial order while its balance is unpaid. */
  BALANCE_UNSETTLED = "BALANCE_UNSETTLED",

  /** Cannot change fulfilment route while a courier holds the parcel. */
  SHIPMENT_ACTIVE = "SHIPMENT_ACTIVE",
  /** The phone on the delivery address is unverified — always required for partial. */
  PHONE_NOT_VERIFIED = "PHONE_NOT_VERIFIED",
}