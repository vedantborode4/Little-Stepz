import { z } from "zod";
import { isoDate, listQuery, money, optionalFilterId, optionalText, requiredText } from "./common";
import { PAYMENT_METHODS } from "./enums";

export const PAYMENT_DIRECTIONS = ["IN", "OUT"] as const;
export type PaymentDirection = (typeof PAYMENT_DIRECTIONS)[number];
export const PAYMENT_DIRECTION_LABELS: Record<PaymentDirection, string> = { IN: "Received", OUT: "Paid out" };

export const CREDIT_ENTRY_TYPES = ["OVERPAYMENT", "APPLIED", "REFUNDED", "CANCELLED_ORDER", "RETURN", "REVERSAL"] as const;
export type CreditEntryType = (typeof CREDIT_ENTRY_TYPES)[number];
export const CREDIT_ENTRY_TYPE_LABELS: Record<CreditEntryType, string> = {
  OVERPAYMENT: "Kept as credit",
  APPLIED: "Used on an order",
  REFUNDED: "Refunded",
  CANCELLED_ORDER: "From a cancelled order",
  RETURN: "From returned items",
  REVERSAL: "Reversal",
};

/** Derived from allocations, never stored. */
export const PAYMENT_STATUSES = ["UNPAID", "PARTIAL", "PAID", "OVERPAID", "REFUNDED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: "Unpaid",
  PARTIAL: "Partially paid",
  PAID: "Paid",
  OVERPAID: "Overpaid",
  REFUNDED: "Refunded",
};

export const AGEING_BUCKETS = ["0-30", "31-60", "60+"] as const;
export type AgeingBucket = (typeof AGEING_BUCKETS)[number];

const positiveMoney = money.refine((v) => Number(v) > 0, "Must be greater than 0");

const optionalMoney = z
  .union([z.literal(""), z.null(), money])
  .transform((v) => (v === "" ? null : v))
  .optional();

/** One leg of a split payment at the till (cash, PhonePe, ...). */
export const tenderSchema = z.object({
  accountId: z.string().uuid("Choose where the money went"),
  amount: positiveMoney,
  reference: optionalText(80),
});
export type TenderInput = z.infer<typeof tenderSchema>;

export const allocationSchema = z.object({ orderId: z.string().uuid(), amount: positiveMoney });

export const receivePaymentSchema = z
  .object({
    customerId: z
      .union([z.literal(""), z.string().uuid()])
      .transform((v) => v || null)
      .nullish(),
    accountId: z.string().uuid("Choose where the money went"),
    amount: positiveMoney,
    /** Provider fee; blank = the account's default fee %. */
    fee: optionalMoney,
    reference: optionalText(80),
    businessDate: isoDate.optional(),
    notes: optionalText(500),
    allocations: z.array(allocationSchema).max(100).default([]),
    /** Whatever isn't allocated must be explicitly kept as customer credit. */
    excessToCredit: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    v.allocations.forEach((a, i) => {
      if (seen.has(a.orderId)) ctx.addIssue({ code: "custom", path: ["allocations", i, "orderId"], message: "Order listed twice" });
      seen.add(a.orderId);
    });
  });
export type ReceivePaymentInput = z.infer<typeof receivePaymentSchema>;

export const applyCreditSchema = z.object({ orderId: z.string().uuid(), amount: positiveMoney });
export type ApplyCreditInput = z.infer<typeof applyCreditSchema>;

export const refundCreditSchema = z.object({
  accountId: z.string().uuid("Choose the account the refund is paid from"),
  amount: positiveMoney,
  reference: optionalText(80),
  notes: optionalText(500),
});
export type RefundCreditInput = z.infer<typeof refundCreditSchema>;

export const voidPaymentSchema = z.object({ reason: requiredText(200) });
export type VoidPaymentInput = z.infer<typeof voidPaymentSchema>;

/** What happens to money already paid on an order that is being cancelled. */
export const cancelSettlementSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("CREDIT") }),
  z.object({ mode: z.literal("REFUND"), accountId: z.string().uuid("Choose the refund account"), reference: optionalText(80) }),
]);
export type CancelSettlementInput = z.infer<typeof cancelSettlementSchema>;

export const accountTransferSchema = z
  .object({
    fromAccountId: z.string().uuid("Choose the source account"),
    toAccountId: z.string().uuid("Choose the destination account"),
    amount: positiveMoney,
    businessDate: isoDate.optional(),
    reference: optionalText(80),
    notes: optionalText(500),
  })
  .refine((v) => v.fromAccountId !== v.toAccountId, { path: ["toAccountId"], message: "Choose a different account" });
export type AccountTransferInput = z.infer<typeof accountTransferSchema>;

export const reverseTransferSchema = z.object({ reason: requiredText(200) });

export const paymentListQuery = listQuery.extend({
  direction: z.enum(PAYMENT_DIRECTIONS).optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  accountId: optionalFilterId,
  customerId: optionalFilterId,
  /** "business" or "personal" receiving accounts. */
  accountKind: z.enum(["business", "personal"]).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});
export type PaymentListQuery = z.infer<typeof paymentListQuery>;

export const collectionsQuery = z.object({ from: isoDate, to: isoDate });
export type CollectionsQuery = z.infer<typeof collectionsQuery>;

export const outstandingQuery = listQuery.extend({
  customerId: optionalFilterId,
  bucket: z.enum(AGEING_BUCKETS).optional(),
});
export type OutstandingQuery = z.infer<typeof outstandingQuery>;

export const transferListQuery = listQuery.extend({ from: isoDate.optional(), to: isoDate.optional() });
export type TransferListQuery = z.infer<typeof transferListQuery>;
