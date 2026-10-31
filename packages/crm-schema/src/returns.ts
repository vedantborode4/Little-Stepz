import { z } from "zod";
import { isoDate, listQuery, money, optionalFilterId, optionalText, requiredText } from "./common";

export const RETURN_CONDITIONS = ["RESELLABLE", "DAMAGED", "WRITE_OFF"] as const;
export type ReturnCondition = (typeof RETURN_CONDITIONS)[number];
export const RETURN_CONDITION_LABELS: Record<ReturnCondition, string> = {
  RESELLABLE: "Resellable — back to stock",
  DAMAGED: "Damaged — to damaged stock",
  WRITE_OFF: "Not coming back — write off",
};

/** How money is given back. NONE when nothing was overpaid (e.g. an unpaid credit sale just owes less). */
export const REFUND_METHODS = ["NONE", "REFUND", "CREDIT"] as const;
export type RefundMethod = (typeof REFUND_METHODS)[number];
export const REFUND_METHOD_LABELS: Record<RefundMethod, string> = {
  NONE: "Nothing to refund",
  REFUND: "Refunded",
  CREDIT: "Kept as customer credit",
};

const returnLineSchema = z.object({
  orderLineId: z.string().uuid(),
  quantity: z.coerce.number().int("Whole units only").min(1, "At least 1").max(10_000),
  condition: z.enum(RETURN_CONDITIONS),
});

const returnFields = {
  lines: z.array(returnLineSchema).min(1, "Choose at least one item").max(200),
  /** Part of the shipping charged to give back (GST-inclusive). */
  shippingRefund: money.default("0"),
};

function uniqueLines(lines: { orderLineId: string }[], ctx: z.RefinementCtx) {
  const seen = new Set<string>();
  lines.forEach((l, i) => {
    if (seen.has(l.orderLineId)) ctx.addIssue({ code: "custom", path: ["lines", i, "orderLineId"], message: "Listed twice" });
    seen.add(l.orderLineId);
  });
}

export const returnPreviewSchema = z.object(returnFields).superRefine((v, ctx) => uniqueLines(v.lines, ctx));
export type ReturnPreviewInput = z.infer<typeof returnPreviewSchema>;

export const createReturnSchema = z
  .object({
    ...returnFields,
    reason: requiredText(200),
    /** Where returned goods are put back; defaults to the order's location. */
    locationId: z.string().uuid().optional(),
    businessDate: isoDate.optional(),
    /** Needed only when money must go back: REFUND (from an account) or CREDIT. */
    refund: z
      .discriminatedUnion("method", [
        z.object({ method: z.literal("CREDIT") }),
        z.object({ method: z.literal("REFUND"), accountId: z.string().uuid("Choose the refund account"), reference: optionalText(80) }),
      ])
      .optional(),
  })
  .superRefine((v, ctx) => uniqueLines(v.lines, ctx));
export type CreateReturnInput = z.infer<typeof createReturnSchema>;

export const returnListQuery = listQuery.extend({
  customerId: optionalFilterId,
  from: isoDate.optional(),
  to: isoDate.optional(),
});
export type ReturnListQuery = z.infer<typeof returnListQuery>;
