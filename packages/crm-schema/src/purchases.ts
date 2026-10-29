import { z } from "zod";
import { CURRENCY_CODES } from "./catalog";
import { isoDate, listQuery, money, optionalText, requiredText } from "./common";
import { STOCK_BUCKETS } from "./inventory";

export const PURCHASE_STATUSES = ["DRAFT", "RECEIVED", "CANCELLED"] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];
export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  DRAFT: "Draft",
  RECEIVED: "Received",
  CANCELLED: "Cancelled",
};

export const ALLOCATION_METHODS = ["VALUE", "QUANTITY", "WEIGHT", "VOLUME"] as const;
export type AllocationMethod = (typeof ALLOCATION_METHODS)[number];
export const ALLOCATION_METHOD_LABELS: Record<AllocationMethod, string> = {
  VALUE: "By purchase value",
  QUANTITY: "By quantity",
  WEIGHT: "By weight",
  VOLUME: "By volume (CBM)",
};

export const CHARGE_TYPES = ["FREIGHT", "CUSTOMS_DUTY", "CLEARING", "IGST", "GST", "LOCAL_TRANSPORT", "INSURANCE", "OTHER"] as const;
export type ChargeType = (typeof CHARGE_TYPES)[number];
export const CHARGE_TYPE_LABELS: Record<ChargeType, string> = {
  FREIGHT: "Freight",
  CUSTOMS_DUTY: "Customs duty",
  CLEARING: "Clearing / CHA",
  IGST: "IGST (import)",
  GST: "GST on invoice",
  LOCAL_TRANSPORT: "Local transport",
  INSURANCE: "Insurance",
  OTHER: "Other",
};
/** Input tax that's normally claimable as credit. A default only; each charge can be changed. */
export const RECOVERABLE_BY_DEFAULT: ReadonlySet<ChargeType> = new Set(["IGST", "GST"]);

/** Decimal string with at most `dp` decimals and a positive value. */
const positiveDecimal = (dp: number, label: string) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .pipe(
      z
        .string()
        .regex(new RegExp(`^\\d{1,12}(\\.\\d{1,${dp}})?$`), `Enter ${label} with at most ${dp} decimals`)
        .refine((v) => Number(v) > 0, "Must be greater than 0"),
    );

const optionalPositiveDecimal = (dp: number, label: string) =>
  z
    .union([z.literal(""), z.null(), positiveDecimal(dp, label)])
    .transform((v) => (v === "" ? null : v))
    .optional();

const unitPrice = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .pipe(z.string().regex(/^\d{1,12}(\.\d{1,4})?$/, "Enter a price with at most 4 decimals"));

export const purchaseLineSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.coerce.number().int("Whole units only").min(1, "At least 1").max(1_000_000),
  unitPrice,
  weightKg: optionalPositiveDecimal(3, "a weight"),
  cbm: optionalPositiveDecimal(6, "a volume"),
});
export type PurchaseLineInput = z.infer<typeof purchaseLineSchema>;

export const shipmentChargeSchema = z.object({
  type: z.enum(CHARGE_TYPES),
  description: optionalText(120),
  amount: money.refine((v) => Number(v) > 0, "Must be greater than 0"),
  currency: z.enum(CURRENCY_CODES),
  isRecoverableTax: z.boolean().default(false),
});
export type ShipmentChargeInput = z.infer<typeof shipmentChargeSchema>;

/** Everything needed to compute landed cost; shared by the draft form and the preview. */
export const landedCostInputSchema = z
  .object({
    currency: z.enum(CURRENCY_CODES),
    exchangeRate: positiveDecimal(6, "a rate"),
    allocationMethod: z.enum(ALLOCATION_METHODS).default("VALUE"),
    lines: z.array(purchaseLineSchema).min(1, "Add at least one item").max(300),
    charges: z.array(shipmentChargeSchema).max(30).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.currency === "INR" && Number(v.exchangeRate) !== 1) {
      ctx.addIssue({ code: "custom", path: ["exchangeRate"], message: "INR purchases use a rate of 1" });
    }
    const seen = new Set<string>();
    v.lines.forEach((l, i) => {
      if (seen.has(l.variantId)) ctx.addIssue({ code: "custom", path: ["lines", i, "variantId"], message: "This item is listed twice" });
      seen.add(l.variantId);
      if (v.allocationMethod === "WEIGHT" && !l.weightKg) {
        ctx.addIssue({ code: "custom", path: ["lines", i, "weightKg"], message: "Weight is needed to split charges by weight" });
      }
      if (v.allocationMethod === "VOLUME" && !l.cbm) {
        ctx.addIssue({ code: "custom", path: ["lines", i, "cbm"], message: "Volume is needed to split charges by volume" });
      }
    });
    v.charges.forEach((c, i) => {
      if (c.currency !== "INR" && c.currency !== v.currency) {
        ctx.addIssue({ code: "custom", path: ["charges", i, "currency"], message: `Use INR or ${v.currency}` });
      }
    });
    if (v.allocationMethod === "VALUE" && v.lines.every((l) => Number(l.unitPrice) === 0) && v.charges.some((c) => !c.isRecoverableTax)) {
      ctx.addIssue({ code: "custom", path: ["allocationMethod"], message: "All prices are 0 — split charges by quantity instead" });
    }
  });
export type LandedCostInput = z.infer<typeof landedCostInputSchema>;

export const purchaseDraftSchema = z
  .object({
    supplierId: z.string().uuid("Choose a supplier"),
    invoiceNumber: optionalText(60),
    shipmentRef: optionalText(60),
    invoiceDate: isoDate,
    locationId: z.string().uuid("Choose where the goods arrive"),
    notes: optionalText(2000),
  })
  .and(landedCostInputSchema);
export type PurchaseDraftInput = z.infer<typeof purchaseDraftSchema>;

export const receivePurchaseSchema = z.object({ businessDate: isoDate.optional() });
export type ReceivePurchaseInput = z.infer<typeof receivePurchaseSchema>;

export const lateChargeSchema = z.object({
  type: z.enum(CHARGE_TYPES),
  description: optionalText(120),
  amountInr: money.refine((v) => Number(v) > 0, "Must be greater than 0"),
  isRecoverableTax: z.boolean().default(false),
  allocationMethod: z.enum(ALLOCATION_METHODS).optional(),
  businessDate: isoDate.optional(),
});
export type LateChargeInput = z.infer<typeof lateChargeSchema>;

export const purchaseReturnSchema = z
  .object({
    locationId: z.string().uuid("Choose where the goods are"),
    bucket: z.enum(STOCK_BUCKETS).default("SELLABLE"),
    reason: requiredText(200),
    businessDate: isoDate.optional(),
    lines: z
      .array(z.object({ purchaseLineId: z.string().uuid(), quantity: z.coerce.number().int().min(1, "At least 1").max(1_000_000) }))
      .min(1, "Return at least one item")
      .max(300),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    v.lines.forEach((l, i) => {
      if (seen.has(l.purchaseLineId)) ctx.addIssue({ code: "custom", path: ["lines", i], message: "Listed twice" });
      seen.add(l.purchaseLineId);
    });
  });
export type PurchaseReturnInput = z.infer<typeof purchaseReturnSchema>;

const optionalFilterId = z
  .union([z.literal(""), z.string().uuid()])
  .transform((v) => v || undefined)
  .optional();

export const purchaseListQuery = listQuery.extend({
  supplierId: optionalFilterId,
  status: z.enum(PURCHASE_STATUSES).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});
export type PurchaseListQuery = z.infer<typeof purchaseListQuery>;
