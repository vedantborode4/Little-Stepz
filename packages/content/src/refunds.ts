/**
 * Single source of truth for refund-timing copy.
 *
 * This text has to agree across the push/in-app notification, both storefronts and
 * the cancellation policy page. It previously existed only inside a notification
 * body ("5–7 working days") — which the web storefront never renders — while the
 * policy page quoted no window at all, so a cancelling customer saw nothing about
 * their money and support fielded the difference.
 */
export const REFUND_WORKING_DAYS = 7;

/** Prepaid: money was captured and is being sent back. */
export const REFUND_INITIATED_TEXT =
  `Your refund will be initiated within ${REFUND_WORKING_DAYS} working days.`;

/**
 * COD: nothing was ever charged. Saying "refund" here is simply wrong and is a
 * reliable way to generate a "where is my refund?" ticket for money that never moved.
 */
export const REFUND_NONE_COD_TEXT =
  "No payment was taken for this order, so there is nothing to refund.";

/** The gateway refused the refund; a human is already on it. */
export const REFUND_FAILED_TEXT =
  "We're processing your refund — our team will be in touch shortly.";

export type RefundOutcome = "initiated" | "none" | "failed";

/** Map the API's `refund` field to the sentence a customer should read. */
export function refundMessage(status: RefundOutcome | string | undefined): string {
  switch (status) {
    case "initiated":
      return REFUND_INITIATED_TEXT;
    case "failed":
      return REFUND_FAILED_TEXT;
    default:
      return REFUND_NONE_COD_TEXT;
  }
}

/** Full cancellation confirmation, e.g. for a dialog body. */
export function cancellationMessage(status: RefundOutcome | string | undefined): string {
  return `Your order has been cancelled. ${refundMessage(status)}`;
}
