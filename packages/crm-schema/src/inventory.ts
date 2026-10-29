import { z } from "zod";
import { isoDate, listQuery, money, optionalText, requiredText } from "./common";

export const STOCK_BUCKETS = ["SELLABLE", "DAMAGED", "DEMO", "QUARANTINE"] as const;
export type StockBucket = (typeof STOCK_BUCKETS)[number];
export const STOCK_BUCKET_LABELS: Record<StockBucket, string> = {
  SELLABLE: "Sellable",
  DAMAGED: "Damaged",
  DEMO: "Demo",
  QUARANTINE: "Quarantine",
};

export const STOCK_DOCUMENT_TYPES = [
  "OPENING",
  "PURCHASE",
  "SALE",
  "SALE_RETURN",
  "PURCHASE_RETURN",
  "TRANSFER",
  "BUCKET_MOVE",
  "WRITE_OFF",
  "ADJUSTMENT",
  "REVERSAL",
] as const;
export type StockDocumentType = (typeof STOCK_DOCUMENT_TYPES)[number];
export const STOCK_DOCUMENT_TYPE_LABELS: Record<StockDocumentType, string> = {
  OPENING: "Opening stock",
  PURCHASE: "Purchase",
  SALE: "Sale",
  SALE_RETURN: "Sales return",
  PURCHASE_RETURN: "Purchase return",
  TRANSFER: "Transfer",
  BUCKET_MOVE: "Status change",
  WRITE_OFF: "Write-off",
  ADJUSTMENT: "Adjustment",
  REVERSAL: "Reversal",
};

export const STOCK_REASON_CODES = [
  "MISSING",
  "DAMAGED",
  "DEMO_USE",
  "THEFT",
  "COUNT_CORRECTION",
  "FOUND",
  "DATA_ENTRY_ERROR",
  "OTHER",
] as const;
export type StockReasonCode = (typeof STOCK_REASON_CODES)[number];
export const STOCK_REASON_LABELS: Record<StockReasonCode, string> = {
  MISSING: "Missing",
  DAMAGED: "Damaged",
  DEMO_USE: "Used as demo",
  THEFT: "Theft",
  COUNT_CORRECTION: "Physical count correction",
  FOUND: "Found stock",
  DATA_ENTRY_ERROR: "Data entry error",
  OTHER: "Other",
};

export const STOCK_STATES = ["OK", "LOW", "OUT"] as const;
export type StockState = (typeof STOCK_STATES)[number];

const MAX_LINES = 500;
const quantity = z.coerce.number().int("Whole units only").min(1, "At least 1").max(1_000_000);
const signedQuantity = z.coerce
  .number()
  .int("Whole units only")
  .min(-1_000_000)
  .max(1_000_000)
  .refine((v) => v !== 0, "Can't be 0");

/** Blank means unknown — the CRM records it as unknown rather than guessing a cost. */
const optionalUnitCost = z
  .union([z.literal(""), z.null(), money])
  .transform((v) => (v === "" ? null : v))
  .optional();

const documentFields = {
  /** IST calendar date the movement happened; defaults to today. */
  businessDate: isoDate.optional(),
  reference: optionalText(120),
  notes: optionalText(1000),
};

function uniqueVariants<T extends { variantId: string }>(lines: T[], ctx: z.RefinementCtx) {
  const seen = new Set<string>();
  lines.forEach((l, i) => {
    if (seen.has(l.variantId)) ctx.addIssue({ code: "custom", path: ["lines", i, "variantId"], message: "This item is listed twice" });
    seen.add(l.variantId);
  });
}

export const openingStockSchema = z
  .object({
    locationId: z.string().uuid("Choose a location"),
    bucket: z.enum(STOCK_BUCKETS).default("SELLABLE"),
    ...documentFields,
    lines: z
      .array(z.object({ variantId: z.string().uuid(), quantity, unitCost: optionalUnitCost }))
      .min(1, "Add at least one item")
      .max(MAX_LINES),
  })
  .superRefine((v, ctx) => uniqueVariants(v.lines, ctx));
export type OpeningStockInput = z.infer<typeof openingStockSchema>;

const movementLines = z
  .array(z.object({ variantId: z.string().uuid(), quantity }))
  .min(1, "Add at least one item")
  .max(MAX_LINES);

export const transferSchema = z
  .object({
    fromLocationId: z.string().uuid("Choose where the stock is now"),
    toLocationId: z.string().uuid("Choose where it is going"),
    bucket: z.enum(STOCK_BUCKETS).default("SELLABLE"),
    reason: requiredText(200),
    ...documentFields,
    lines: movementLines,
  })
  .superRefine((v, ctx) => {
    if (v.fromLocationId === v.toLocationId)
      ctx.addIssue({ code: "custom", path: ["toLocationId"], message: "Choose a different location" });
    uniqueVariants(v.lines, ctx);
  });
export type TransferInput = z.infer<typeof transferSchema>;

export const bucketMoveSchema = z
  .object({
    locationId: z.string().uuid("Choose a location"),
    fromBucket: z.enum(STOCK_BUCKETS),
    toBucket: z.enum(STOCK_BUCKETS),
    reasonCode: z.enum(STOCK_REASON_CODES).optional(),
    reason: requiredText(200),
    ...documentFields,
    lines: movementLines,
  })
  .superRefine((v, ctx) => {
    if (v.fromBucket === v.toBucket) ctx.addIssue({ code: "custom", path: ["toBucket"], message: "Choose a different status" });
    uniqueVariants(v.lines, ctx);
  });
export type BucketMoveInput = z.infer<typeof bucketMoveSchema>;

export const writeOffSchema = z
  .object({
    locationId: z.string().uuid("Choose a location"),
    bucket: z.enum(STOCK_BUCKETS),
    reasonCode: z.enum(STOCK_REASON_CODES),
    reason: requiredText(200),
    ...documentFields,
    lines: movementLines,
  })
  .superRefine((v, ctx) => uniqueVariants(v.lines, ctx));
export type WriteOffInput = z.infer<typeof writeOffSchema>;

export const adjustmentSchema = z
  .object({
    locationId: z.string().uuid("Choose a location"),
    bucket: z.enum(STOCK_BUCKETS).default("SELLABLE"),
    reasonCode: z.enum(STOCK_REASON_CODES),
    reason: requiredText(200),
    ...documentFields,
    lines: z
      .array(z.object({ variantId: z.string().uuid(), quantity: signedQuantity }))
      .min(1, "Add at least one item")
      .max(MAX_LINES),
  })
  .superRefine((v, ctx) => uniqueVariants(v.lines, ctx));
export type AdjustmentInput = z.infer<typeof adjustmentSchema>;

export const reverseStockDocumentSchema = z.object({ reason: requiredText(200) });
export type ReverseStockDocumentInput = z.infer<typeof reverseStockDocumentSchema>;

const optionalFilterId = z
  .union([z.literal(""), z.string().uuid()])
  .transform((v) => v || undefined)
  .optional();

export const stockListQuery = listQuery.extend({
  categoryId: optionalFilterId,
  locationId: optionalFilterId,
  state: z.enum(STOCK_STATES).optional(),
  includeEmpty: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
});
export type StockListQuery = z.infer<typeof stockListQuery>;

export const ledgerQuery = listQuery.extend({
  variantId: optionalFilterId,
  productId: optionalFilterId,
  locationId: optionalFilterId,
  type: z.enum(STOCK_DOCUMENT_TYPES).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});
export type LedgerQuery = z.infer<typeof ledgerQuery>;
