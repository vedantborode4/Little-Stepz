/**
 * Single source of truth for partial-payment copy.
 *
 * Following the same reasoning as `refunds.ts`: the deposit-forfeiture sentence has to
 * appear identically at checkout, on the order detail, inside the cancel dialog, in the
 * emails and on the cancellation policy page. It is the contractual basis for keeping a
 * customer's money, so five slightly different wordings is not a cosmetic problem.
 *
 * Every function takes the amount rather than a percentage, deliberately. "20%" is easy
 * to skim past; "₹900" is not, and a rupee figure is what a customer disputing a
 * forfeited deposit will be shown.
 */

/** Rupee formatting that matches the storefronts' own. */
function inr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export const PARTIAL_PAYMENT_LABEL = "Pay 20% now, rest on delivery";
export const PARTIAL_PAYMENT_SHORT = "20% now · rest on delivery";

/** The plan option's own description, given the split. */
export function partialPlanSummary(deposit: number, balance: number): string {
  return `Pay ${inr(deposit)} now. ${inr(balance)} is collected by the delivery agent at your door.`;
}

/**
 * The warning. Always rendered inline and never behind a tooltip or a "terms apply"
 * link — a customer must not be able to reach the pay button without having seen it.
 */
export function forfeitureWarning(deposit: number): string {
  return `The ${inr(deposit)} you pay now is not refunded if you refuse delivery or cancel this order.`;
}

/** The acknowledgement label. Ticking it is the record that the term was accepted. */
export function forfeitureAckLabel(deposit: number): string {
  return `I understand the ${inr(deposit)} deposit is not refundable if I refuse delivery or cancel.`;
}

/** Shown on an order whose balance the courier will collect. */
export function balanceAtDoorText(balance: number): string {
  return `Keep ${inr(balance)} ready — the delivery agent will collect it when your order arrives.`;
}

/** Shown above a cancel button on an order that still holds a deposit. */
export function cancelForfeitWarning(deposit: number): string {
  return `Cancelling this order forfeits your ${inr(deposit)} deposit.`;
}

/** Shown once a deposit has actually been kept. */
export function depositForfeitedText(deposit: number): string {
  return `The ${inr(deposit)} deposit was retained under our cancellation terms.`;
}

/**
 * Why the option is not on offer, from the code the checkout quote returns.
 *
 * Hidden-with-a-reason rather than silently absent: an unexplained missing option is a
 * reliable way to generate "my friend got this and I didn't" tickets.
 */
export function partialReasonText(code: string, meta?: Record<string, unknown>): string {
  switch (code) {
    case "ITEMS_NOT_ELIGIBLE": {
      const n = Number(meta?.count ?? 0);
      return n === 1
        ? "One item in your cart can't be paid in instalments."
        : `${n} items in your cart can't be paid in instalments.`;
    }
    case "PINCODE_COD_UNAVAILABLE":
      return `Pay-later isn't available for ${meta?.pincode ?? "this pincode"} — our courier can't collect payment there.`;
    case "PHONE_NOT_VERIFIED":
      return "Verify the phone number on this address to unlock pay-later.";
    case "ORDER_VALUE_ABOVE_CAP":
      return `Pay-later is available on orders up to ${inr(Number(meta?.cap ?? 0))}.`;
    case "TOO_MANY_OPEN_BALANCES": {
      const open = Number(meta?.open ?? 0);
      return `You already have ${open} order${open === 1 ? "" : "s"} with a balance due. Pay one off to use this again.`;
    }
    case "PARTIAL_AMOUNT_TOO_SMALL":
      return "This order is too small to split into two payments.";
    case "PARTIAL_PAYMENT_DISABLED":
    default:
      return "Pay-later isn't available right now.";
  }
}
