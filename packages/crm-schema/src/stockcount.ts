import { z } from "zod";
import { listQuery, optionalFilterId, optionalText, requiredText } from "./common";
import { STOCK_REASON_CODES } from "./inventory";

export const STOCK_COUNT_STATUSES = ["OPEN", "SUBMITTED", "APPROVED", "CANCELLED", "REVERSED"] as const;
export type StockCountStatus = (typeof STOCK_COUNT_STATUSES)[number];
export const STOCK_COUNT_STATUS_LABELS: Record<StockCountStatus, string> = {
  OPEN: "Counting",
  SUBMITTED: "Waiting for approval",
  APPROVED: "Approved",
  CANCELLED: "Cancelled",
  REVERSED: "Reversed",
};

export const createStockCountSchema = z.object({
  locationId: z.string().uuid("Choose the location to count"),
  /** Count one category only; blank = everything with sellable stock at the location. */
  categoryId: z
    .union([z.literal(""), z.string().uuid()])
    .transform((v) => v || null)
    .nullish(),
  /** Counters don't see what the system expects, so they count what's really there. */
  blind: z.boolean().default(true),
  /** Also list items the system thinks are at zero (to catch stock it doesn't know about). */
  includeZero: z.boolean().default(false),
  notes: optionalText(500),
});
export type CreateStockCountInput = z.infer<typeof createStockCountSchema>;

const countedQty = z.union([z.null(), z.coerce.number().int("Whole units only").min(0, "Can't be negative").max(1_000_000)]);

export const saveCountsSchema = z.object({
  lines: z
    .array(z.object({ lineId: z.string().uuid(), countedQty }))
    .min(1)
    .max(2000),
});
export type SaveCountsInput = z.infer<typeof saveCountsSchema>;

export const addCountLineSchema = z.object({ variantId: z.string().uuid() });

export const approveStockCountSchema = z.object({
  reason: requiredText(200),
  /** Why each difference happened; defaults to a count correction. */
  lines: z
    .array(z.object({ lineId: z.string().uuid(), reasonCode: z.enum(STOCK_REASON_CODES), note: optionalText(200) }))
    .max(2000)
    .default([]),
});
export type ApproveStockCountInput = z.infer<typeof approveStockCountSchema>;

export const stockCountReasonSchema = z.object({ reason: requiredText(200) });

export const stockCountListQuery = listQuery.extend({
  status: z.enum(STOCK_COUNT_STATUSES).optional(),
  locationId: optionalFilterId,
});
export type StockCountListQuery = z.infer<typeof stockCountListQuery>;
