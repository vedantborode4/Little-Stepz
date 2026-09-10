/**
 * Single source of truth for Cash on Delivery copy, shared by both storefronts.
 *
 * Kept beside `partial-payment.ts` rather than inside it: the two are separate checkout
 * options with different terms, and a reason code like ITEMS_NOT_ELIGIBLE means something
 * different for each.
 */

function inr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export const COD_LABEL = "Cash on Delivery";

/** The option's description at checkout. */
export function codPlanSummary(total: number): string {
  return `Pay ${inr(total)} in cash when your order arrives.`;
}

/** Shown on an order the courier has yet to collect. */
export function codDueAtDoorText(total: number): string {
  return `Keep ${inr(total)} ready — the delivery agent will collect it when your order arrives.`;
}

/** Why Cash on Delivery is not on offer, from the code the checkout quote returns. */
export function codReasonText(code: string, meta?: Record<string, unknown>): string {
  switch (code) {
    case "ITEMS_NOT_ELIGIBLE": {
      const n = Number(meta?.count ?? 0);
      return n === 1
        ? "One item in your cart can't be paid with Cash on Delivery."
        : `${n} items in your cart can't be paid with Cash on Delivery.`;
    }
    case "PINCODE_COD_UNAVAILABLE":
      return `Cash on Delivery isn't available for ${meta?.pincode ?? "this pincode"} — our courier can't collect payment there.`;
    case "PHONE_NOT_VERIFIED":
      return "Verify the phone number on this address to unlock Cash on Delivery.";
    case "ORDER_VALUE_ABOVE_CAP":
      return `Cash on Delivery is available on orders up to ${inr(Number(meta?.cap ?? 0))}.`;
    case "TOO_MANY_OPEN_COD_ORDERS": {
      const open = Number(meta?.open ?? 0);
      return `You already have ${open} Cash on Delivery order${open === 1 ? "" : "s"} on the way. Pay online for this one, or try again once one is delivered.`;
    }
    case "COD_BLOCKED_REFUSALS":
      return "Cash on Delivery isn't available on this account after a previously undelivered order. You can still pay online.";
    case "COD_DISABLED":
    default:
      return "Cash on Delivery isn't available right now.";
  }
}
