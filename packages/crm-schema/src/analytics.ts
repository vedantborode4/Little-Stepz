import { z } from "zod";
import { isoDate, optionalFilterId } from "./common";
import { SALES_CHANNELS } from "./sales";

export const analyticsRangeQuery = z.object({ from: isoDate, to: isoDate });
export type AnalyticsRangeQuery = z.infer<typeof analyticsRangeQuery>;

export const PROFIT_DIMENSIONS = ["product", "variant", "category", "channel"] as const;
export type ProfitDimension = (typeof PROFIT_DIMENSIONS)[number];

export const profitBreakdownQuery = analyticsRangeQuery.extend({
  by: z.enum(PROFIT_DIMENSIONS).default("product"),
  categoryId: optionalFilterId,
  productId: optionalFilterId,
  channel: z.enum(SALES_CHANNELS).optional(),
});
export type ProfitBreakdownQuery = z.infer<typeof profitBreakdownQuery>;

export const valuationQuery = z.object({
  categoryId: optionalFilterId,
  productId: optionalFilterId,
  locationId: optionalFilterId,
  q: z.string().trim().max(100).optional(),
});
export type ValuationQuery = z.infer<typeof valuationQuery>;

export const dashboardQuery = z.object({
  categoryId: optionalFilterId,
  productId: optionalFilterId,
});
export type DashboardQuery = z.infer<typeof dashboardQuery>;

/** Report catalogue: the 17 reports the owner asked for. */
export const REPORT_KEYS = [
  "product-master",
  "variant-stock",
  "purchase-history",
  "inventory-ledger",
  "daily-sales",
  "monthly-sales",
  "customer-purchases",
  "collections",
  "outstanding",
  "advances-preorders",
  "courier-expenses",
  "profit-by-product",
  "discount-impact",
  "inventory-valuation",
  "potential-profit",
  "damaged-stock",
  "stock-reconciliation",
] as const;
export type ReportKey = (typeof REPORT_KEYS)[number];

export const REPORT_FILTERS = ["dateRange", "location", "category", "customer"] as const;
export type ReportFilter = (typeof REPORT_FILTERS)[number];

export const reportQuery = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  locationId: optionalFilterId,
  categoryId: optionalFilterId,
  customerId: optionalFilterId,
  format: z.enum(["csv", "xlsx"]).optional(),
});
export type ReportQuery = z.infer<typeof reportQuery>;

export const reportKeyParam = z.object({ key: z.enum(REPORT_KEYS) });
