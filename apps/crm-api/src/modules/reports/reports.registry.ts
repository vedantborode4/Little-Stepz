import { prisma, Prisma } from "@repo/crm-db/client";
import {
  advancesQuery,
  ledgerQuery,
  outstandingQuery,
  PAYMENT_DIRECTION_LABELS,
  PAYMENT_METHOD_LABELS,
  paymentListQuery,
  PRICE_SOURCE_LABELS,
  SALES_CHANNEL_LABELS,
  SALES_ORDER_STATUS_LABELS,
  SALES_ORDER_TYPE_LABELS,
  SHIPMENT_STATUS_LABELS,
  shipmentListQuery,
  STOCK_BUCKET_LABELS,
  STOCK_DOCUMENT_TYPE_LABELS,
  STOCK_REASON_LABELS,
  stockListQuery,
  type Permission,
  type ReportFilter,
  type ReportKey,
  type ReportQuery,
} from "@repo/crm-schema";
import { fromDbDate, todayIST, toDbDate } from "../../core/dates";
import { EXPORT_MAX_ROWS } from "../../core/list";
import { Decimal, money } from "../../core/money";
import { maskMobile } from "../../core/pii";
import { profitBreakdown, valuation } from "../analytics/analytics.service";
import { stockTotals } from "../inventory/inventory.service";
import { listLedger, listStock } from "../inventory/inventory.queries";
import { listAdvances, listOutstanding, listPayments } from "../payments/payments.queries";
import { salesSummary } from "../sales/sales.reports";
import { listShipments } from "../shipping/shipments.service";

export interface ReportContext {
  costs: boolean;
}

/** Rows as plain values keyed by column header, so preview and export share one shape. */
type Row = Record<string, string | number | boolean | null>;

export interface ReportSpec {
  key: ReportKey;
  title: string;
  description: string;
  group: string;
  filters: ReportFilter[];
  /** All of these are needed (on top of reports.view). */
  permissions: Permission[];
  load: (q: ReportQuery, ctx: ReportContext) => Promise<Row[]>;
}

const d = (v: Prisma.Decimal | string | number | null | undefined) => new Decimal((v ?? 0).toString());
const num = (v: string | null | undefined) => (v === null || v === undefined ? null : Number(v));
const all = { page: "1", limit: "100", format: "csv" };

const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
/** Defaults when a dated report is opened without dates: the last `days` days up to today. */
const window = (q: ReportQuery, days: number) => ({ from: q.from ?? addDays(todayIST(), -(days - 1)), to: q.to ?? todayIST() });

const costCols = (ctx: ReportContext, cols: Row): Row => (ctx.costs ? cols : {});

/** Day-by-day or month-by-month sales, each period computed exactly as the sales summary does. */
async function salesByPeriod(periods: { label: string; from: string; to: string }[], ctx: ReportContext): Promise<Row[]> {
  const out: Row[] = [];
  for (const p of periods) {
    const s = await salesSummary({ from: p.from, to: p.to }, { costs: ctx.costs });
    out.push({
      Period: p.label,
      Orders: s.orders,
      Units: s.units,
      "Gross sales incl. GST": num(s.grossSales),
      Discounts: num(s.discounts),
      Returns: num(s.returns),
      "Net sales excl. GST": num(s.netSales),
      GST: num(s.gst),
      ...costCols(ctx, { "Cost of goods": num(s.cogs), "Gross profit": num(s.grossProfit), "Unknown-cost units": s.unknownCostUnits ?? 0 }),
    });
  }
  return out;
}

export const REPORTS: ReportSpec[] = [
  {
    key: "product-master",
    title: "Product master",
    description: "Every product and variant with prices, GST, website IDs and stock.",
    group: "Catalog & stock",
    filters: ["category"],
    permissions: ["products.view"],
    async load(q, ctx) {
      const variants = await prisma.variant.findMany({
        where: { product: { status: { not: "ARCHIVED" }, ...(q.categoryId && { categoryId: q.categoryId }) } },
        include: { product: { include: { category: true, brand: true } }, cost: true },
        orderBy: [{ product: { name: "asc" } }, { position: "asc" }],
        take: EXPORT_MAX_ROWS,
      });
      const stock = await stockTotals(variants.map((v) => v.id));
      return variants.map((v) => ({
        "Product code": v.product.code,
        Product: v.product.name,
        Category: v.product.category.name,
        Brand: v.product.brand?.name ?? "",
        Scale: v.product.scale ?? "",
        "Product status": v.product.status,
        "Variant status": v.status,
        HSN: v.product.hsnCode ?? "",
        "GST %": Number(v.product.gstRate),
        SKU: v.sku,
        Variant: v.name,
        "Regular price": Number(v.regularPrice),
        "Offer price": v.offerPrice ? Number(v.offerPrice) : null,
        "Wholesale price": v.wholesalePrice ? Number(v.wholesalePrice) : null,
        "Website product ID": v.product.websiteProductId ?? "",
        "Website variant ID": v.websiteVariantId ?? "",
        Physical: stock.get(v.id)?.physical ?? 0,
        Available: stock.get(v.id)?.available ?? 0,
        ...costCols(ctx, {
          "Average landed cost": v.cost && v.cost.valuedQty > 0 ? Number(d(v.cost.totalValue).div(v.cost.valuedQty).toFixed(2)) : null,
        }),
      }));
    },
  },
  {
    key: "variant-stock",
    title: "Variant stock",
    description: "Stock per variant by status: sellable, damaged, demo, quarantine, reserved and available.",
    group: "Catalog & stock",
    filters: ["location", "category"],
    permissions: ["inventory.view"],
    async load(q, ctx) {
      const { items } = await listStock(
        stockListQuery.parse({ ...all, locationId: q.locationId, categoryId: q.categoryId, includeEmpty: "false" }),
        ctx,
      );
      return items.map((r) => ({
        SKU: r.sku,
        Product: r.productName,
        Variant: r.variantName,
        Category: r.categoryName,
        Sellable: r.sellable,
        Damaged: r.damaged,
        Demo: r.demo,
        Quarantine: r.quarantine,
        Physical: r.physical,
        Reserved: r.reserved,
        Available: r.available,
        "Reorder level": r.reorderLevel,
        State: r.state,
        ...costCols(ctx, {
          "Average cost": num(r.avgUnitCost),
          "Stock value": num(r.stockValue),
          "Unknown-cost units": r.unvaluedQty ?? 0,
        }),
      }));
    },
  },
  {
    key: "purchase-history",
    title: "Purchase history",
    description: "Every purchased line with currency, rate, charges and frozen landed cost.",
    group: "Purchasing",
    filters: ["dateRange"],
    permissions: ["purchases.view"],
    async load(q, ctx) {
      const w = window(q, 365);
      const lines = await prisma.purchaseLine.findMany({
        where: { shipment: { status: { not: "CANCELLED" }, invoiceDate: { gte: toDbDate(w.from), lte: toDbDate(w.to) } } },
        include: { shipment: { include: { supplier: true } }, variant: { include: { product: true } } },
        orderBy: [{ shipment: { invoiceDate: "desc" } }, { position: "asc" }],
        take: EXPORT_MAX_ROWS,
      });
      return lines.map((l) => ({
        Purchase: l.shipment.code,
        "Invoice date": fromDbDate(l.shipment.invoiceDate),
        Status: l.shipment.status,
        Supplier: l.shipment.supplier.name,
        Invoice: l.shipment.invoiceNumber ?? "",
        SKU: l.variant.sku,
        Item: `${l.variant.product.name} — ${l.variant.name}`,
        Quantity: l.quantity,
        Currency: l.shipment.currency,
        ...costCols(ctx, {
          "Exchange rate": Number(l.shipment.exchangeRate),
          "Unit price (purchase currency)": Number(l.unitPrice),
          "Unit price INR": l.unitPriceInr ? Number(d(l.unitPriceInr).toFixed(2)) : null,
          "Charges per unit": l.allocatedCharges ? Number(d(l.allocatedCharges).toFixed(2)) : null,
          "Landed cost per unit": l.landedUnitCost ? Number(d(l.landedUnitCost).toFixed(2)) : null,
          "Landed total": l.landedUnitCost ? Number(d(l.landedUnitCost).mul(l.quantity).toFixed(2)) : null,
        }),
      }));
    },
  },
  {
    key: "inventory-ledger",
    title: "Inventory ledger",
    description: "Every stock movement with date, entry, reason, user and cost.",
    group: "Catalog & stock",
    filters: ["dateRange", "location"],
    permissions: ["inventory.view"],
    async load(q, ctx) {
      const w = window(q, 31);
      const { items } = await listLedger(ledgerQuery.parse({ ...all, ...w, locationId: q.locationId }), ctx);
      return items.map((m) => ({
        Date: m.businessDate,
        Entry: m.documentCode,
        Type: STOCK_DOCUMENT_TYPE_LABELS[m.effectiveType],
        SKU: m.sku,
        Item: `${m.productName} — ${m.variantName}`,
        Location: m.locationCode,
        Status: STOCK_BUCKET_LABELS[m.bucket],
        Quantity: m.quantity,
        ...costCols(ctx, { "Unit cost": num(m.unitCost) }),
        Reason: m.reason,
        "Reason code": m.reasonCode ? STOCK_REASON_LABELS[m.reasonCode] : "",
        Reference: m.reference ?? "",
        By: m.createdByName ?? "",
      }));
    },
  },
  {
    key: "daily-sales",
    title: "Daily sales",
    description: "Sales recognised each day (fulfilled orders less returns).",
    group: "Sales",
    filters: ["dateRange"],
    permissions: ["sales.view"],
    async load(q, ctx) {
      const w = window(q, 30);
      const days: { label: string; from: string; to: string }[] = [];
      for (let day = w.from; day <= w.to && days.length < 366; day = addDays(day, 1)) days.push({ label: day, from: day, to: day });
      return salesByPeriod(days, ctx);
    },
  },
  {
    key: "monthly-sales",
    title: "Monthly sales",
    description: "Sales recognised each month (fulfilled orders less returns).",
    group: "Sales",
    filters: ["dateRange"],
    permissions: ["sales.view"],
    async load(q, ctx) {
      const w = window(q, 365);
      const months: { label: string; from: string; to: string }[] = [];
      let start = `${w.from.slice(0, 7)}-01`;
      while (start <= w.to && months.length < 60) {
        const next = new Date(`${start}T00:00:00Z`);
        next.setUTCMonth(next.getUTCMonth() + 1);
        const end = addDays(next.toISOString().slice(0, 10), -1);
        months.push({ label: start.slice(0, 7), from: start < w.from ? w.from : start, to: end > w.to ? w.to : end });
        start = next.toISOString().slice(0, 10);
      }
      return salesByPeriod(months, ctx);
    },
  },
  {
    key: "customer-purchases",
    title: "Customer purchase history",
    description: "What each customer bought, line by line. Phone numbers are masked.",
    group: "Customers & shipping",
    filters: ["dateRange", "customer"],
    permissions: ["customers.view", "sales.view"],
    async load(q) {
      const w = window(q, 365);
      const lines = await prisma.salesOrderLine.findMany({
        where: {
          order: {
            customerId: q.customerId ?? { not: null },
            fulfilledAt: { not: null },
            fulfilledDate: { gte: toDbDate(w.from), lte: toDbDate(w.to) },
          },
        },
        include: {
          order: { include: { customer: true } },
          variant: { include: { product: true } },
          returnLines: { select: { quantity: true } },
        },
        orderBy: [{ order: { fulfilledDate: "desc" } }, { position: "asc" }],
        take: EXPORT_MAX_ROWS,
      });
      return lines.map((l) => ({
        Customer: l.order.customer?.name ?? "",
        "Customer code": l.order.customer?.code ?? "",
        Mobile: maskMobile(l.order.customer?.mobile ?? null) ?? "",
        Order: l.order.code,
        Date: l.order.fulfilledDate ? fromDbDate(l.order.fulfilledDate) : "",
        Channel: SALES_CHANNEL_LABELS[l.order.channel],
        SKU: l.variant.sku,
        Item: `${l.variant.product.name} — ${l.variant.name}`,
        Quantity: l.quantity,
        Returned: l.returnLines.reduce((s, r) => s + r.quantity, 0),
        "Unit price": Number(l.unitPrice),
        "Line total incl. GST": Number(l.lineTotal),
      }));
    },
  },
  {
    key: "collections",
    title: "Cash and UPI collections",
    description: "Every payment in and out by method and account, business and personal.",
    group: "Payments",
    filters: ["dateRange"],
    permissions: ["payments.view"],
    async load(q) {
      const w = window(q, 31);
      const { items } = await listPayments(paymentListQuery.parse({ ...all, ...w }));
      return items.map((p) => ({
        Payment: p.code,
        Date: p.businessDate,
        Direction: PAYMENT_DIRECTION_LABELS[p.direction],
        Method: PAYMENT_METHOD_LABELS[p.method],
        Account: p.account.name,
        "Personal account": p.account.isPersonal ? "Yes" : "No",
        Amount: p.direction === "OUT" ? -Number(p.amount) : Number(p.amount),
        Fee: Number(p.fee),
        Reference: p.reference ?? "",
        Customer: p.customer?.name ?? "Walk-in",
        Orders: p.orderCodes.join(", "),
        Voids: p.reversalOf?.code ?? "",
      }));
    },
  },
  {
    key: "outstanding",
    title: "Outstanding payments",
    description: "Balances still due, aged from the order date.",
    group: "Payments",
    filters: ["customer"],
    permissions: ["payments.view"],
    async load(q) {
      const { items } = await listOutstanding(outstandingQuery.parse({ ...all, customerId: q.customerId }));
      return items.map((o) => ({
        Order: o.code,
        Customer: o.customer?.name ?? "Walk-in",
        "Order date": o.orderDate,
        "Due date": o.dueDate ?? "",
        Status: SALES_ORDER_STATUS_LABELS[o.status],
        "Net value": Number(o.grandTotal),
        Paid: Number(o.paid),
        Due: Number(o.due),
        "Age (days)": o.ageDays,
        Bucket: o.bucket,
        Overdue: o.overdue ? "Yes" : "No",
        Delivered: o.fulfilled ? "Yes" : "No",
      }));
    },
  },
  {
    key: "advances-preorders",
    title: "Advances and pre-orders",
    description: "Money held for orders not yet handed over or dispatched (a liability, not revenue).",
    group: "Payments",
    filters: ["customer"],
    permissions: ["payments.view"],
    async load(q) {
      const { items } = await listAdvances(advancesQuery.parse({ ...all, customerId: q.customerId }));
      return items.map((a) => ({
        Order: a.code,
        Type: SALES_ORDER_TYPE_LABELS[a.type],
        Status: SALES_ORDER_STATUS_LABELS[a.status],
        Customer: a.customer?.name ?? "Walk-in",
        "Order date": a.orderDate,
        "Expected arrival": a.expectedArrival ?? "",
        Total: Number(a.grandTotal),
        "Advance held": Number(a.paid),
        Balance: Number(a.due),
      }));
    },
  },
  {
    key: "courier-expenses",
    title: "Courier expenses",
    description: "What each shipment cost against the shipping charged to the customer.",
    group: "Customers & shipping",
    filters: ["dateRange"],
    permissions: ["shipping.manage"],
    async load(q) {
      const w = window(q, 31);
      const { items } = await listShipments(shipmentListQuery.parse({ ...all, ...w }));
      return items.map((s) => ({
        Shipment: s.code,
        Order: s.order.code,
        Customer: s.customer?.name ?? "",
        Courier: s.courier?.name ?? "",
        AWB: s.awbs.join(", "),
        Status: SHIPMENT_STATUS_LABELS[s.status],
        Dispatched: s.dispatchedAt?.slice(0, 10) ?? "",
        Delivered: s.deliveredAt?.slice(0, 10) ?? "",
        "Courier cost": Number(s.courierCost),
        "Charged to customer": Number(s.chargedToCustomer),
        Difference: Number(d(s.chargedToCustomer).sub(s.courierCost).toFixed(2)),
      }));
    },
  },
  {
    key: "profit-by-product",
    title: "Profit by product",
    description: "Net sales, cost and gross profit per variant, net of returns. Unknown-cost units are counted, not priced.",
    group: "Profit",
    filters: ["dateRange", "category"],
    permissions: ["reports.financial", "costs.view"],
    async load(q) {
      const w = window(q, 31);
      const rows = await profitBreakdown({ ...w, by: "variant", categoryId: q.categoryId });
      return rows.map((r) => ({
        Item: r.label,
        SKU: r.sublabel ?? "",
        Units: r.units,
        "Net sales excl. GST": Number(r.netSales),
        Discounts: Number(r.discounts),
        "Cost of goods": Number(r.cogs),
        "Gross profit": Number(r.grossProfit),
        "Margin %": r.marginPercent === null ? null : Number(r.marginPercent),
        "Unknown-cost units": r.unknownCostUnits,
      }));
    },
  },
  {
    key: "discount-impact",
    title: "Discount impact",
    description: "Every sold line against its regular price: price reductions, item and order discounts.",
    group: "Profit",
    filters: ["dateRange", "category"],
    permissions: ["sales.view"],
    async load(q) {
      const w = window(q, 31);
      const lines = await prisma.salesOrderLine.findMany({
        where: {
          order: { fulfilledAt: { not: null }, fulfilledDate: { gte: toDbDate(w.from), lte: toDbDate(w.to) } },
          ...(q.categoryId && { variant: { product: { categoryId: q.categoryId } } }),
        },
        include: { order: true, variant: { include: { product: true } } },
        orderBy: [{ order: { fulfilledDate: "desc" } }, { position: "asc" }],
        take: EXPORT_MAX_ROWS,
      });
      return lines.map((l) => {
        const regularValue = d(l.regularPrice).mul(l.quantity);
        const reduction = Decimal.max(d(l.regularPrice).sub(l.unitPrice.toString()), 0).mul(l.quantity);
        const discounts = d(l.lineDiscount).add(l.orderDiscountShare.toString());
        return {
          Date: l.order.fulfilledDate ? fromDbDate(l.order.fulfilledDate) : "",
          Order: l.order.code,
          Channel: SALES_CHANNEL_LABELS[l.order.channel],
          SKU: l.variant.sku,
          Item: `${l.variant.product.name} — ${l.variant.name}`,
          Quantity: l.quantity,
          "Price used": PRICE_SOURCE_LABELS[l.priceSource],
          "Regular value": Number(regularValue.toFixed(2)),
          "Below regular price": Number(reduction.toFixed(2)),
          "Item discount": Number(l.lineDiscount),
          "Order discount share": Number(l.orderDiscountShare),
          "Total given away": Number(reduction.add(discounts).toFixed(2)),
          "Sold for incl. GST": Number(l.lineTotal),
        };
      });
    },
  },
  {
    key: "inventory-valuation",
    title: "Current inventory valuation",
    description: "Available units at average landed cost. Units with unknown cost are listed but not valued.",
    group: "Profit",
    filters: ["location", "category"],
    permissions: ["reports.financial", "costs.view"],
    async load(q) {
      const v = await valuation({ locationId: q.locationId, categoryId: q.categoryId });
      return v.rows.map((r) => ({
        SKU: r.sku,
        Item: `${r.productName} — ${r.variantName}`,
        Category: r.categoryName,
        Available: r.available,
        "Average landed cost": num(r.avgCost),
        "Cost value": Number(r.costValue),
        "Unknown-cost units": r.unknownCostUnits,
      }));
    },
  },
  {
    key: "potential-profit",
    title: "Potential future profit",
    description: "Projections for unsold stock at regular and offer prices. Projections, not earned profit.",
    group: "Profit",
    filters: ["location", "category"],
    permissions: ["reports.financial", "costs.view"],
    async load(q) {
      const v = await valuation({ locationId: q.locationId, categoryId: q.categoryId });
      return v.rows.map((r) => ({
        SKU: r.sku,
        Item: `${r.productName} — ${r.variantName}`,
        Available: r.available,
        "Cost value": Number(r.costValue),
        "Regular price": Number(r.regularPrice),
        "Revenue at regular": Number(r.regular.revenue),
        "Profit at regular (before GST)": Number(r.regular.profitBeforeGst),
        "Profit at regular (net of GST)": Number(r.regular.profitNetOfGst),
        "Offer price": num(r.offerPrice),
        "Revenue at offer": Number(r.offer.revenue),
        "Profit at offer (before GST)": Number(r.offer.profitBeforeGst),
        "Profit at offer (net of GST)": Number(r.offer.profitNetOfGst),
        "Unknown-cost units": r.unknownCostUnits,
      }));
    },
  },
  {
    key: "damaged-stock",
    title: "Damaged stock",
    description: "Units held as damaged, demo or in quarantine, by location.",
    group: "Catalog & stock",
    filters: ["location", "category"],
    permissions: ["inventory.view"],
    async load(q, ctx) {
      const rows = await prisma.stockBalance.findMany({
        where: {
          bucket: { not: "SELLABLE" },
          quantity: { gt: 0 },
          locationId: q.locationId,
          ...(q.categoryId && { variant: { product: { categoryId: q.categoryId } } }),
        },
        include: { location: true, variant: { include: { product: true, cost: true } } },
        orderBy: [{ variant: { sku: "asc" } }],
        take: EXPORT_MAX_ROWS,
      });
      return rows.map((b) => {
        const c = b.variant.cost;
        const avg = c && c.valuedQty > 0 ? d(c.totalValue).div(c.valuedQty) : null;
        return {
          Location: b.location.name,
          SKU: b.variant.sku,
          Item: `${b.variant.product.name} — ${b.variant.name}`,
          Status: STOCK_BUCKET_LABELS[b.bucket],
          Units: b.quantity,
          ...costCols(ctx, { "Value at average cost": avg ? Number(avg.mul(b.quantity).toFixed(2)) : null }),
        };
      });
    },
  },
  {
    key: "stock-reconciliation",
    title: "Stock reconciliation",
    description: "Approved stock counts: system against counted, the difference, reason and approver.",
    group: "Catalog & stock",
    filters: ["dateRange", "location"],
    permissions: ["inventory.view"],
    async load(q) {
      const w = window(q, 90);
      const lines = await prisma.stockCountLine.findMany({
        where: {
          count: {
            status: { in: ["APPROVED", "REVERSED"] },
            locationId: q.locationId,
            approvedAt: { gte: toDbDate(w.from), lt: toDbDate(addDays(w.to, 1)) },
          },
        },
        include: { count: { include: { location: true, approvedBy: true } }, variant: { include: { product: true } } },
        orderBy: [{ count: { approvedAt: "desc" } }],
        take: EXPORT_MAX_ROWS,
      });
      return lines.map((l) => ({
        Count: l.count.code,
        Location: l.count.location.name,
        Approved: l.count.approvedAt?.toISOString().slice(0, 10) ?? "",
        "Approved by": l.count.approvedBy?.name ?? "",
        "Count status": l.count.status,
        SKU: l.variant.sku,
        Item: `${l.variant.product.name} — ${l.variant.name}`,
        System: l.systemQty,
        Counted: l.countedQty,
        Difference: (l.countedQty ?? l.systemQty) - l.systemQty,
        Reason: l.reasonCode ? STOCK_REASON_LABELS[l.reasonCode] : "",
        Note: l.note ?? "",
      }));
    },
  },
];

export const REPORT_GROUPS = ["Sales", "Payments", "Profit", "Catalog & stock", "Purchasing", "Customers & shipping"];
