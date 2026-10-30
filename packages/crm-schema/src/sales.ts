import { z } from "zod";
import { isoDate, listQuery, money, optionalFilterId, optionalId, optionalText, requiredText } from "./common";
import { cancelSettlementSchema, tenderSchema } from "./payments";

export const SALES_CHANNELS = ["STORE", "WEBSITE", "WHATSAPP", "INSTAGRAM", "FACEBOOK", "WHOLESALE", "OTHER"] as const;
export type SalesChannel = (typeof SALES_CHANNELS)[number];
export const SALES_CHANNEL_LABELS: Record<SalesChannel, string> = {
  STORE: "Store (walk-in)",
  WEBSITE: "Website",
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  WHOLESALE: "Wholesale",
  OTHER: "Other",
};
/** Channels counted as offline in reports; the rest are online. */
export const OFFLINE_CHANNELS: ReadonlySet<SalesChannel> = new Set(["STORE", "WHOLESALE"]);

export const SALES_ORDER_TYPES = ["REGULAR", "PRE_ORDER"] as const;
export type SalesOrderType = (typeof SALES_ORDER_TYPES)[number];
export const SALES_ORDER_TYPE_LABELS: Record<SalesOrderType, string> = {
  REGULAR: "Order",
  PRE_ORDER: "Pre-order",
};

export const SALES_ORDER_STATUSES = ["DRAFT", "CONFIRMED", "PACKED", "DISPATCHED", "DELIVERED", "COMPLETED", "CANCELLED"] as const;
export type SalesOrderStatus = (typeof SALES_ORDER_STATUSES)[number];
export const SALES_ORDER_STATUS_LABELS: Record<SalesOrderStatus, string> = {
  DRAFT: "Draft",
  CONFIRMED: "Confirmed",
  PACKED: "Packed",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

/**
 * COUNTER: handed over in person — stock leaves at handover (immediately for a POS sale).
 * DELIVERY: shipped — stock is reserved at confirmation and leaves at dispatch.
 */
export const FULFILMENT_METHODS = ["COUNTER", "DELIVERY"] as const;
export type FulfilmentMethod = (typeof FULFILMENT_METHODS)[number];
export const FULFILMENT_METHOD_LABELS: Record<FulfilmentMethod, string> = {
  COUNTER: "Counter / pickup",
  DELIVERY: "Courier delivery",
};

/** Which price a line was sold at. Resolution order: customer > tier > wholesale > offer > regular; MANUAL is an admin override. */
export const PRICE_SOURCES = ["CUSTOMER", "TIER", "WHOLESALE", "OFFER", "REGULAR", "MANUAL"] as const;
export type PriceSource = (typeof PRICE_SOURCES)[number];
export const PRICE_SOURCE_LABELS: Record<PriceSource, string> = {
  CUSTOMER: "Customer price",
  TIER: "Quantity price",
  WHOLESALE: "Wholesale",
  OFFER: "Offer",
  REGULAR: "Regular",
  MANUAL: "Manual price",
};

export const MAX_SALE_LINES = 200;

const optionalMoney = z
  .union([z.literal(""), z.null(), money])
  .transform((v) => (v === "" ? null : v))
  .optional();

export const saleLineSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.coerce.number().int("Whole units only").min(1, "At least 1").max(10_000),
  /** Overrides the resolved price (admins only). Blank = use the resolved price. */
  unitPrice: optionalMoney,
  /** Rupees off the whole line, GST-inclusive. */
  lineDiscount: money.default("0"),
});
export type SaleLineInput = z.infer<typeof saleLineSchema>;

function uniqueLines(lines: { variantId: string }[], ctx: z.RefinementCtx) {
  const seen = new Set<string>();
  lines.forEach((l, i) => {
    if (seen.has(l.variantId)) ctx.addIssue({ code: "custom", path: ["lines", i, "variantId"], message: "This item is listed twice" });
    seen.add(l.variantId);
  });
}

const cartFields = {
  customerId: optionalId,
  channel: z.enum(SALES_CHANNELS),
  fulfilment: z.enum(FULFILMENT_METHODS).default("COUNTER"),
  locationId: z.string().uuid("Choose the stock location"),
  lines: z.array(saleLineSchema).min(1, "Add at least one item").max(MAX_SALE_LINES),
  /** Rupees off the whole order, GST-inclusive; split across lines by value. */
  orderDiscount: money.default("0"),
  shippingCharged: money.default("0"),
};

/** Prices, discounts and GST for a cart without saving anything (POS and order form live totals). */
export const saleQuoteSchema = z.object(cartFields).superRefine((v, ctx) => uniqueLines(v.lines, ctx));
export type SaleQuoteInput = z.infer<typeof saleQuoteSchema>;

/**
 * A completed counter sale. `idempotencyKey` is generated once per checkout, so a
 * double-click or a retried request returns the same sale instead of a second one.
 */
export const posSaleSchema = z
  .object({
    ...cartFields,
    channel: cartFields.channel.default("STORE"),
    fulfilment: z.literal("COUNTER").default("COUNTER"),
    idempotencyKey: z.string().uuid(),
    notes: optionalText(1000),
    /** Split tender: one entry per account the money went to. Walk-ins must pay in full. */
    payments: z.array(tenderSchema).max(10).default([]),
    /** Money beyond the total is kept as the customer's credit (needs a customer). */
    excessToCredit: z.boolean().default(false),
  })
  .superRefine((v, ctx) => uniqueLines(v.lines, ctx));
export type PosSaleInput = z.infer<typeof posSaleSchema>;

export const salesOrderSchema = z
  .object({
    ...cartFields,
    type: z.enum(SALES_ORDER_TYPES).default("REGULAR"),
    /** IST order date; defaults to today. */
    orderDate: isoDate.optional(),
    /** Payment due date; defaults to the order date plus the customer's credit days. */
    dueDate: z
      .union([z.literal(""), isoDate])
      .transform((v) => v || undefined)
      .optional(),
    /** Pre-orders: when the stock is expected. */
    expectedArrival: z
      .union([z.literal(""), isoDate])
      .transform((v) => v || undefined)
      .optional(),
    externalRef: optionalText(80),
    notes: optionalText(1000),
    /** Save straight to Confirmed (reserves stock) instead of Draft. */
    confirm: z.boolean().default(false),
  })
  .superRefine((v, ctx) => uniqueLines(v.lines, ctx));
export type SalesOrderInput = z.infer<typeof salesOrderSchema>;

export const cancelOrderSchema = z.object({
  reason: requiredText(200),
  /** Required when money has already been paid on the order. */
  settlement: cancelSettlementSchema.optional(),
});
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;

export const salesListQuery = listQuery.extend({
  status: z.enum(SALES_ORDER_STATUSES).optional(),
  channel: z.enum(SALES_CHANNELS).optional(),
  type: z.enum(SALES_ORDER_TYPES).optional(),
  fulfilment: z.enum(FULFILMENT_METHODS).optional(),
  customerId: optionalFilterId,
  from: isoDate.optional(),
  to: isoDate.optional(),
});
export type SalesListQuery = z.infer<typeof salesListQuery>;

export const sellableSearchQuery = z.object({
  q: z.string().trim().min(1).max(100),
  locationId: z.string().uuid(),
});
export type SellableSearchQuery = z.infer<typeof sellableSearchQuery>;

export const salesSummaryQuery = z.object({ from: isoDate, to: isoDate });
export type SalesSummaryQuery = z.infer<typeof salesSummaryQuery>;
