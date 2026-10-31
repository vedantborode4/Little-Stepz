import { prisma, Prisma } from "@repo/crm-db/client";
import {
  type AnalyticsRangeQuery,
  type DashboardDto,
  type DashboardQuery,
  type ProfitBreakdownQuery,
  type ProfitBreakdownRowDto,
  type ProfitDimension,
  type ProfitWaterfallDto,
  type ValuationDto,
  type ValuationQuery,
  type ValuationRowDto,
  type ValuationScenarioDto,
} from "@repo/crm-schema";
import { todayIST, toDbDate } from "../../core/dates";
import { Decimal, decOrZero, money, round2 } from "../../core/money";
import { advancesSummary, collections, outstandingSummary } from "../payments/payments.queries";
import { salesSummary } from "../sales/sales.reports";

const pct = (part: Decimal, whole: Decimal) => (whole.isZero() ? null : part.div(whole).mul(100).toFixed(1));

const range = (q: AnalyticsRangeQuery) => ({ gte: toDbDate(q.from), lte: toDbDate(q.to) });

/** Money moved by rows that may be voided by mirror rows: originals count, reversals subtract. */
function netOfReversals(rows: { reversalOfId: string | null; _sum: Record<string, Prisma.Decimal | null> }[], field: string) {
  return rows.reduce(
    (s, r) => (r.reversalOfId === null ? s.add(decOrZero(r._sum[field])) : s.sub(decOrZero(r._sum[field]))),
    new Decimal(0),
  );
}

/**
 * The period's sales all the way down to operating profit. Revenue is what was
 * fulfilled on those IST dates less returns dated in them (advances never
 * appear). Gross profit only covers lines whose cost is known.
 */
export async function profitWaterfall(query: AnalyticsRangeQuery): Promise<ProfitWaterfallDto> {
  const dates = range(query);
  const fulfilled: Prisma.SalesOrderWhereInput = { fulfilledAt: { not: null }, fulfilledDate: dates };
  const [summary, orders, returns, shipping, fees, expenses, reductions, lateCharges] = await Promise.all([
    salesSummary(query, { costs: true }),
    prisma.salesOrder.aggregate({
      where: fulfilled,
      _count: true,
      _sum: { subtotal: true, shippingCharged: true, lineDiscounts: true, orderDiscount: true, grandTotal: true },
    }),
    prisma.salesReturn.aggregate({ where: { businessDate: dates }, _sum: { amount: true } }),
    prisma.shipment.aggregate({ where: { status: { not: "CANCELLED" }, order: fulfilled }, _sum: { courierCost: true } }),
    prisma.payment.groupBy({ by: ["reversalOfId"], where: { businessDate: dates, fee: { gt: 0 } }, _sum: { fee: true } }),
    prisma.expense.groupBy({ by: ["kind", "reversalOfId"], where: { businessDate: dates }, _sum: { amount: true } }),
    prisma.$queryRaw<{ total: Prisma.Decimal | null }[]>`
      SELECT SUM(GREATEST(l."regularPrice" - l."unitPrice", 0) * l.quantity) AS total
      FROM "SalesOrderLine" l JOIN "SalesOrder" o ON o.id = l."orderId"
      WHERE o."fulfilledAt" IS NOT NULL AND o."fulfilledDate" BETWEEN ${dates.gte} AND ${dates.lte}`,
    prisma.costAdjustmentLine.aggregate({ where: { adjustment: { businessDate: dates } }, _sum: { toCostOfSales: true } }),
  ]);

  const grossProfit = decOrZero(summary.grossProfit);
  const shippingExpense = decOrZero(shipping._sum.courierCost);
  const paymentFees = netOfReversals(fees, "fee");
  const orderExpenses = netOfReversals(
    expenses.filter((e) => e.kind === "ORDER"),
    "amount",
  );
  const operatingExpenses = netOfReversals(
    expenses.filter((e) => e.kind === "OPERATING"),
    "amount",
  );
  const lateChargeCost = decOrZero(lateCharges._sum.toCostOfSales);
  const contribution = grossProfit.sub(shippingExpense).sub(paymentFees).sub(orderExpenses).sub(lateChargeCost);
  const netSales = decOrZero(summary.netSales);
  const returnsAmount = decOrZero(returns._sum.amount);

  return {
    from: query.from,
    to: query.to,
    orders: orders._count,
    units: summary.units,
    grossSales: money(decOrZero(orders._sum.subtotal).add(decOrZero(orders._sum.shippingCharged))),
    discounts: money(decOrZero(orders._sum.lineDiscounts).add(decOrZero(orders._sum.orderDiscount))),
    returns: money(returnsAmount),
    netSalesInclGst: money(decOrZero(orders._sum.grandTotal).sub(returnsAmount)),
    gst: summary.gst,
    netSales: summary.netSales,
    cogs: summary.cogs!,
    grossProfit: money(grossProfit),
    marginPercent: pct(grossProfit, netSales),
    shippingExpense: money(shippingExpense),
    paymentFees: money(paymentFees),
    orderExpenses: money(orderExpenses),
    lateCharges: money(lateChargeCost),
    contributionProfit: money(contribution),
    operatingExpenses: money(operatingExpenses),
    operatingProfit: money(contribution.sub(operatingExpenses)),
    priceReductions: money(decOrZero(reductions[0]?.total)),
    unknownCostUnits: summary.unknownCostUnits ?? 0,
  };
}

const DIMENSIONS: Record<ProfitDimension, { key: Prisma.Sql; label: Prisma.Sql; sub: Prisma.Sql }> = {
  product: { key: Prisma.sql`p.id`, label: Prisma.sql`p.name`, sub: Prisma.sql`p.code` },
  variant: { key: Prisma.sql`v.id`, label: Prisma.sql`p.name || ' — ' || v.name`, sub: Prisma.sql`v.sku` },
  category: { key: Prisma.sql`c.id`, label: Prisma.sql`c.name`, sub: Prisma.sql`NULL::text` },
  channel: { key: Prisma.sql`o.channel::text`, label: Prisma.sql`o.channel::text`, sub: Prisma.sql`NULL::text` },
};

interface BreakdownRow {
  key: string;
  label: string;
  sub: string | null;
  units: number;
  net: Prisma.Decimal;
  disc: Prisma.Decimal;
  cogs: Prisma.Decimal;
  netKnown: Prisma.Decimal;
  unknown: number;
}

/**
 * Profit by product, variant, category or channel for the period, net of
 * returns dated in it. Returned units take their revenue back and their cost
 * too, unless written off. Lines with unknown cost are counted, not priced.
 */
export async function profitBreakdown(query: ProfitBreakdownQuery): Promise<ProfitBreakdownRowDto[]> {
  const rows = await breakdownRows(query);
  return rows.map((r) => {
    const grossProfit = decOrZero(r.netKnown).sub(decOrZero(r.cogs));
    return {
      key: r.key,
      label: r.label,
      sublabel: r.sub,
      units: r.units,
      netSales: money(decOrZero(r.net)),
      cogs: money(decOrZero(r.cogs)),
      grossProfit: money(grossProfit),
      marginPercent: pct(grossProfit, decOrZero(r.netKnown)),
      discounts: money(decOrZero(r.disc)),
      unknownCostUnits: r.unknown,
    };
  });
}

function breakdownRows(query: ProfitBreakdownQuery): Promise<BreakdownRow[]> {
  const dates = range(query);
  const dim = DIMENSIONS[query.by];
  const filters: Prisma.Sql[] = [];
  if (query.categoryId) filters.push(Prisma.sql`p."categoryId" = ${query.categoryId}`);
  if (query.productId) filters.push(Prisma.sql`p.id = ${query.productId}`);
  if (query.channel) filters.push(Prisma.sql`o.channel = ${query.channel}::"SalesChannel"`);
  const extra = filters.length ? Prisma.sql`AND ${Prisma.join(filters, " AND ")}` : Prisma.empty;
  const joins = Prisma.sql`
    JOIN "SalesOrder" o ON o.id = l."orderId"
    JOIN "Variant" v ON v.id = l."variantId"
    JOIN "Product" p ON p.id = v."productId"
    JOIN "Category" c ON c.id = p."categoryId"`;

  return prisma.$queryRaw<BreakdownRow[]>`
    WITH moves AS (
      SELECT ${dim.key} AS key, ${dim.label} AS label, ${dim.sub} AS sub,
        l.quantity AS units, l."taxableValue" AS net, l."lineDiscount" + l."orderDiscountShare" AS disc,
        CASE WHEN l."unknownCostQty" = 0 THEN COALESCE(l.cogs, 0) ELSE 0 END AS cogs,
        CASE WHEN l."unknownCostQty" = 0 THEN l."taxableValue" ELSE 0 END AS net_known,
        l."unknownCostQty" AS unknown
      FROM "SalesOrderLine" l ${joins}
      WHERE o."fulfilledAt" IS NOT NULL AND o."fulfilledDate" BETWEEN ${dates.gte} AND ${dates.lte} ${extra}
      UNION ALL
      SELECT ${dim.key}, ${dim.label}, ${dim.sub},
        -rl.quantity, -rl."taxableValue", 0,
        CASE WHEN l."unknownCostQty" = 0 AND rl.condition <> 'WRITE_OFF' THEN -rl.cogs ELSE 0 END,
        CASE WHEN l."unknownCostQty" = 0 THEN -rl."taxableValue" ELSE 0 END,
        0
      FROM "SalesReturnLine" rl
      JOIN "SalesReturn" r ON r.id = rl."returnId"
      JOIN "SalesOrderLine" l ON l.id = rl."orderLineId" ${joins}
      WHERE r."businessDate" BETWEEN ${dates.gte} AND ${dates.lte} ${extra}
    )
    SELECT key, label, sub, SUM(units)::int AS units, SUM(net) AS net, SUM(disc) AS disc, SUM(cogs) AS cogs,
      SUM(net_known) AS "netKnown", SUM(unknown)::int AS unknown
    FROM moves GROUP BY key, label, sub ORDER BY SUM(net) DESC LIMIT 1000`;
}

function scenario(price: Decimal, gstRate: Decimal, available: number, knownUnits: number, avgCost: Decimal | null): ValuationScenarioDto {
  const revenue = price.mul(available);
  if (!avgCost || knownUnits === 0) {
    return { revenue: money(revenue), profitBeforeGst: "0.00", profitNetOfGst: "0.00", marginPercent: null };
  }
  const cost = avgCost.mul(knownUnits);
  const knownRevenue = price.mul(knownUnits);
  const knownNet = round2(knownRevenue.div(gstRate.div(100).add(1)));
  const profitNet = knownNet.sub(cost);
  return {
    revenue: money(revenue),
    profitBeforeGst: money(knownRevenue.sub(cost)),
    profitNetOfGst: money(profitNet),
    marginPercent: pct(profitNet, knownNet),
  };
}

const sumScenarios = (list: ValuationScenarioDto[]): ValuationScenarioDto => {
  const revenue = list.reduce((s, x) => s.add(x.revenue), new Decimal(0));
  const before = list.reduce((s, x) => s.add(x.profitBeforeGst), new Decimal(0));
  const net = list.reduce((s, x) => s.add(x.profitNetOfGst), new Decimal(0));
  return { revenue: money(revenue), profitBeforeGst: money(before), profitNetOfGst: money(net), marginPercent: null };
};

/**
 * What unsold, available stock cost and could bring in at today's regular and
 * offer prices. Always computed from current prices, so a price change moves
 * the projection at once and never touches completed sales. Units without a
 * known cost are valued at nothing and kept out of the profit projection.
 */
export async function valuation(query: ValuationQuery): Promise<ValuationDto> {
  const loc = query.locationId ? Prisma.sql`AND "locationId" = ${query.locationId}` : Prisma.empty;
  const filters: Prisma.Sql[] = [Prisma.sql`COALESCE(b.sellable, 0) - COALESCE(r.reserved, 0) > 0`];
  if (query.categoryId) filters.push(Prisma.sql`p."categoryId" = ${query.categoryId}`);
  if (query.productId) filters.push(Prisma.sql`p.id = ${query.productId}`);
  if (query.q) filters.push(Prisma.sql`(p.name ILIKE ${`%${query.q}%`} OR v.sku ILIKE ${`%${query.q}%`})`);
  const rows = await prisma.$queryRaw<
    {
      id: string;
      sku: string;
      variantName: string;
      productName: string;
      categoryName: string;
      regularPrice: Prisma.Decimal;
      offerPrice: Prisma.Decimal | null;
      gstRate: Prisma.Decimal;
      available: number;
      valuedQty: number | null;
      totalValue: Prisma.Decimal | null;
      unvaluedQty: number | null;
    }[]
  >`
    WITH bal AS (SELECT "variantId", SUM(quantity)::int AS sellable FROM "StockBalance" WHERE bucket = 'SELLABLE' ${loc} GROUP BY "variantId"),
    res AS (SELECT "variantId", SUM(quantity)::int AS reserved FROM "Reservation" WHERE "releasedAt" IS NULL ${loc} GROUP BY "variantId")
    SELECT v.id, v.sku, v.name AS "variantName", p.name AS "productName", c.name AS "categoryName",
      v."regularPrice", v."offerPrice", p."gstRate",
      (COALESCE(b.sellable, 0) - COALESCE(r.reserved, 0))::int AS available,
      vc."valuedQty", vc."totalValue", vc."unvaluedQty"
    FROM "Variant" v
    JOIN "Product" p ON p.id = v."productId"
    JOIN "Category" c ON c.id = p."categoryId"
    JOIN bal b ON b."variantId" = v.id
    LEFT JOIN res r ON r."variantId" = v.id
    LEFT JOIN "VariantCost" vc ON vc."variantId" = v.id
    WHERE ${Prisma.join(filters, " AND ")}
    ORDER BY p.name, v.position`;

  const out: ValuationRowDto[] = rows.map((r) => {
    const avg = r.valuedQty ? decOrZero(r.totalValue).div(r.valuedQty) : null;
    const unknown = Math.min(r.available, r.unvaluedQty ?? 0);
    const known = r.available - unknown;
    const gst = decOrZero(r.gstRate);
    const regular = decOrZero(r.regularPrice);
    const offer = r.offerPrice ? decOrZero(r.offerPrice) : regular;
    return {
      variantId: r.id,
      sku: r.sku,
      productName: r.productName,
      variantName: r.variantName,
      categoryName: r.categoryName,
      available: r.available,
      avgCost: avg ? money(avg) : null,
      costValue: money(avg ? avg.mul(known) : new Decimal(0)),
      unknownCostUnits: unknown,
      regularPrice: money(regular),
      offerPrice: r.offerPrice ? money(decOrZero(r.offerPrice)) : null,
      gstRate: gst.toString(),
      regular: scenario(regular, gst, r.available, known, avg),
      offer: scenario(offer, gst, r.available, known, avg),
    };
  });

  const costValue = out.reduce((s, r) => s.add(r.costValue), new Decimal(0));
  const regular = sumScenarios(out.map((r) => r.regular));
  const offer = sumScenarios(out.map((r) => r.offer));
  const netOf = (list: ValuationRowDto[], pick: (r: ValuationRowDto) => ValuationScenarioDto) =>
    list.reduce((s, r) => s.add(pick(r).profitNetOfGst).add(r.costValue), new Decimal(0));
  regular.marginPercent = pct(
    decOrZero(regular.profitNetOfGst),
    netOf(out, (r) => r.regular),
  );
  offer.marginPercent = pct(
    decOrZero(offer.profitNetOfGst),
    netOf(out, (r) => r.offer),
  );
  return {
    units: out.reduce((s, r) => s + r.available, 0),
    costValue: money(costValue),
    unknownCostUnits: out.reduce((s, r) => s + r.unknownCostUnits, 0),
    regular,
    offer,
    rows: out,
  };
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export interface DashboardRights {
  costs: boolean;
  payments: boolean;
}

/** The home screen's KPIs and charts. Cost and money figures are left out for roles that can't see them. */
export async function dashboard(query: DashboardQuery, rights: DashboardRights): Promise<DashboardDto> {
  const today = todayIST();
  const monthStart = `${today.slice(0, 8)}01`;
  const trendFrom = addDays(today, -29);
  const lineScope: Prisma.Sql[] = [];
  if (query.categoryId) lineScope.push(Prisma.sql`p."categoryId" = ${query.categoryId}`);
  if (query.productId) lineScope.push(Prisma.sql`p.id = ${query.productId}`);
  const scope = lineScope.length ? Prisma.sql`AND ${Prisma.join(lineScope, " AND ")}` : Prisma.empty;
  const scoped = lineScope.length > 0;
  const productScope: Prisma.ProductWhereInput = {
    status: { not: "ARCHIVED" },
    ...(query.categoryId && { categoryId: query.categoryId }),
    ...(query.productId && { id: query.productId }),
  };

  const period = async (from: string, to: string) => {
    if (scoped) return scopedSales(scope, from, to);
    const s = await salesSummary({ from, to }, { costs: false });
    return { grossSales: s.grossSales, netSales: s.netSales, orders: s.orders };
  };
  // Filtered to products, only their lines count: whole-order totals would carry other items and shipping.
  const monthDates = Prisma.sql`o."fulfilledAt" IS NOT NULL AND o."fulfilledDate" BETWEEN ${toDbDate(monthStart)} AND ${toDbDate(today)}`;
  const mixSource = scoped
    ? Prisma.sql`SELECT o.wholesale, o.channel IN ('STORE', 'WHOLESALE') AS offline, SUM(l."lineTotal") AS total
      FROM "SalesOrderLine" l JOIN "SalesOrder" o ON o.id = l."orderId"
      JOIN "Variant" v ON v.id = l."variantId" JOIN "Product" p ON p.id = v."productId"
      WHERE ${monthDates} ${scope}
      GROUP BY 1, 2`
    : Prisma.sql`SELECT o.wholesale, o.channel IN ('STORE', 'WHOLESALE') AS offline, SUM(o."grandTotal") AS total
      FROM "SalesOrder" o WHERE ${monthDates}
      GROUP BY 1, 2`;

  const [
    products,
    variants,
    purchased,
    sold,
    stock,
    todaySales,
    yesterdaySales,
    monthSales,
    lifetimeSales,
    mix,
    trend,
    customers,
    repeat,
    shipments,
    awaitingShipments,
    returnsCount,
  ] = await Promise.all([
    prisma.product.count({ where: productScope }),
    prisma.variant.count({ where: { status: "ACTIVE", product: productScope } }),
    prisma.$queryRaw<{ units: number | null }[]>`
      SELECT SUM(m.quantity)::int AS units
      FROM "StockMovement" m JOIN "StockDocument" d ON d.id = m."documentId"
      JOIN "Variant" v ON v.id = m."variantId" JOIN "Product" p ON p.id = v."productId"
      WHERE d.type IN ('PURCHASE', 'PURCHASE_RETURN') ${scope}`,
    prisma.$queryRaw<{ units: number | null }[]>`
      SELECT (COALESCE((SELECT SUM(l.quantity) FROM "SalesOrderLine" l JOIN "SalesOrder" o ON o.id = l."orderId"
          JOIN "Variant" v ON v.id = l."variantId" JOIN "Product" p ON p.id = v."productId"
          WHERE o."fulfilledAt" IS NOT NULL ${scope}), 0)
        - COALESCE((SELECT SUM(rl.quantity) FROM "SalesReturnLine" rl
          JOIN "Variant" v ON v.id = rl."variantId" JOIN "Product" p ON p.id = v."productId" WHERE TRUE ${scope}), 0))::int AS units`,
    prisma.$queryRaw<{ sellable: number | null; reserved: number | null }[]>`
      SELECT
        (SELECT SUM(b.quantity) FROM "StockBalance" b JOIN "Variant" v ON v.id = b."variantId" JOIN "Product" p ON p.id = v."productId"
          WHERE b.bucket = 'SELLABLE' ${scope})::int AS sellable,
        (SELECT SUM(r.quantity) FROM "Reservation" r JOIN "Variant" v ON v.id = r."variantId" JOIN "Product" p ON p.id = v."productId"
          WHERE r."releasedAt" IS NULL ${scope})::int AS reserved`,
    period(today, today),
    period(addDays(today, -1), addDays(today, -1)),
    period(monthStart, today),
    period("2000-01-01", today),
    prisma.$queryRaw<{ wholesale: boolean; offline: boolean; total: Prisma.Decimal }[]>(mixSource),
    prisma.$queryRaw<{ day: Date; gross: Prisma.Decimal; net: Prisma.Decimal }[]>`
      SELECT o."fulfilledDate" AS day, SUM(l."lineTotal") AS gross, SUM(l."taxableValue") AS net
      FROM "SalesOrderLine" l JOIN "SalesOrder" o ON o.id = l."orderId"
      JOIN "Variant" v ON v.id = l."variantId" JOIN "Product" p ON p.id = v."productId"
      WHERE o."fulfilledAt" IS NOT NULL AND o."fulfilledDate" BETWEEN ${toDbDate(trendFrom)} AND ${toDbDate(today)} ${scope}
      GROUP BY 1 ORDER BY 1`,
    prisma.customer.count({ where: { isActive: true, mergedIntoId: null } }),
    prisma.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM (
        SELECT "customerId" FROM "SalesOrder" WHERE "customerId" IS NOT NULL AND status NOT IN ('DRAFT', 'CANCELLED')
        GROUP BY "customerId" HAVING COUNT(*) >= 2) t`,
    prisma.shipment.groupBy({ by: ["status"], _count: true }),
    prisma.salesOrder.count({
      where: {
        fulfilment: "DELIVERY",
        status: { in: ["CONFIRMED", "PACKED"] },
        shipments: { none: { status: { notIn: ["CANCELLED", "RETURNED"] } } },
      },
    }),
    prisma.salesReturn.count({ where: { businessDate: { gte: toDbDate(monthStart), lte: toDbDate(today) } } }),
  ]);

  const shipCount = (...statuses: string[]) => shipments.filter((s) => statuses.includes(s.status)).reduce((n, s) => n + s._count, 0);
  const sum = (pick: (r: (typeof mix)[number]) => boolean) =>
    money(mix.filter(pick).reduce((s, r) => s.add(decOrZero(r.total)), new Decimal(0)));
  const byDay = new Map(trend.map((t) => [t.day.toISOString().slice(0, 10), t]));
  const monthRange = { from: monthStart, to: today };
  const filter = { categoryId: query.categoryId, productId: query.productId };
  const topBy = query.productId ? "variant" : "product";
  const mixBy = scoped ? "channel" : "category";
  const [top, mixRows] = await Promise.all([
    profitBreakdown({ ...monthRange, by: topBy, ...filter }),
    profitBreakdown({ ...monthRange, by: mixBy, ...filter }),
  ]);
  // Filtered to one product, the product name is already on screen; show just the variant ("Red").
  const variantNames =
    topBy === "variant"
      ? new Map(
          (await prisma.variant.findMany({ where: { productId: query.productId }, select: { id: true, name: true } })).map((v) => [
            v.id,
            v.name,
          ]),
        )
      : null;

  const result: DashboardDto = {
    inventory: {
      products,
      variants,
      unitsPurchased: purchased[0]?.units ?? 0,
      unitsSold: sold[0]?.units ?? 0,
      available: (stock[0]?.sellable ?? 0) - (stock[0]?.reserved ?? 0),
      reserved: stock[0]?.reserved ?? 0,
    },
    sales: {
      today: todaySales,
      yesterday: yesterdaySales,
      monthToDate: monthSales,
      lifetime: lifetimeSales,
      retail: sum((r) => !r.wholesale),
      wholesale: sum((r) => r.wholesale),
      online: sum((r) => !r.offline),
      offline: sum((r) => r.offline),
    },
    customers: {
      total: customers,
      repeat: repeat[0]?.n ?? 0,
      pendingShipments: shipCount("PENDING", "PACKED") + awaitingShipments,
      inTransit: shipCount("DISPATCHED", "IN_TRANSIT", "OUT_FOR_DELIVERY"),
      delivered: shipCount("DELIVERED"),
      returnsAndRto: returnsCount + shipCount("RTO"),
    },
    trend: Array.from({ length: 30 }, (_, i) => {
      const date = addDays(trendFrom, i);
      const t = byDay.get(date);
      return { date, grossSales: money(decOrZero(t?.gross)), netSales: money(decOrZero(t?.net)) };
    }),
    topBy,
    topProducts: top
      .filter((r) => decOrZero(r.netSales).gt(0))
      .slice(0, 5)
      .map((r) => ({ label: variantNames?.get(r.key) ?? r.label, netSales: r.netSales, units: r.units })),
    mixBy,
    categoryMix: mixRows.filter((r) => decOrZero(r.netSales).gt(0)).map((r) => ({ label: r.label, netSales: r.netSales })),
  };

  if (rights.payments) {
    const [todayCollections, monthCollections, advances, outstanding] = await Promise.all([
      collections({ from: today, to: today }),
      collections(monthRange),
      advancesSummary(),
      outstandingSummary({}),
    ]);
    const method = (m: string) => todayCollections.byMethod.find((x) => x.method === m)?.net ?? "0.00";
    result.payments = {
      cashToday: method("CASH"),
      upiToday: method("UPI"),
      gatewayToday: method("GATEWAY"),
      collectedToday: todayCollections.totals.net,
      advances: advances.total,
      outstanding: outstanding.total,
    };
    result.collectionsByMethod = monthCollections.byMethod.map((m) => ({ method: m.method, amount: m.net }));
  }

  if (rights.costs) {
    const [profit, value] = await Promise.all([
      scoped ? scopedProfit({ ...monthRange, ...filter }) : profitWaterfall(monthRange),
      valuation(filter),
    ]);
    result.inventory.costValue = value.costValue;
    result.profit = {
      grossProfit: profit.grossProfit,
      marginPercent: profit.marginPercent,
      discounts: profit.discounts,
      contributionProfit: profit.contributionProfit,
      potentialRevenue: value.offer.revenue,
      potentialProfit: value.offer.profitBeforeGst,
    };
  }
  return result;
}

/** Sales of the filtered products only: their lines, not whole orders, so shipping and other items stay out. */
async function scopedSales(scope: Prisma.Sql, from: string, to: string) {
  const dates = Prisma.sql`BETWEEN ${toDbDate(from)} AND ${toDbDate(to)}`;
  const [row] = await prisma.$queryRaw<
    { gross: Prisma.Decimal | null; net: Prisma.Decimal | null; returned: Prisma.Decimal | null; orders: number }[]
  >`
    WITH sold AS (
      SELECT l."orderId", l."lineTotal", l."taxableValue"
      FROM "SalesOrderLine" l JOIN "SalesOrder" o ON o.id = l."orderId"
      JOIN "Variant" v ON v.id = l."variantId" JOIN "Product" p ON p.id = v."productId"
      WHERE o."fulfilledAt" IS NOT NULL AND o."fulfilledDate" ${dates} ${scope}
    )
    SELECT (SELECT SUM("lineTotal") FROM sold) AS gross,
      (SELECT SUM("taxableValue") FROM sold) AS net,
      (SELECT SUM(rl."taxableValue") FROM "SalesReturnLine" rl JOIN "SalesReturn" r ON r.id = rl."returnId"
        JOIN "Variant" v ON v.id = rl."variantId" JOIN "Product" p ON p.id = v."productId"
        WHERE r."businessDate" ${dates} ${scope}) AS returned,
      (SELECT COUNT(DISTINCT "orderId") FROM sold)::int AS orders`;
  return {
    grossSales: money(decOrZero(row?.gross)),
    netSales: money(decOrZero(row?.net).sub(decOrZero(row?.returned))),
    orders: row?.orders ?? 0,
  };
}

/** Gross profit of the filtered products, by the same line rules as the profit breakdown. */
async function scopedProfit(query: Omit<ProfitBreakdownQuery, "by">) {
  const rows = await breakdownRows({ ...query, by: "category" });
  const total = (pick: (r: BreakdownRow) => Prisma.Decimal) => rows.reduce((s, r) => s.add(decOrZero(pick(r))), new Decimal(0));
  const netKnown = total((r) => r.netKnown);
  const grossProfit = netKnown.sub(total((r) => r.cogs));
  return {
    grossProfit: money(grossProfit),
    marginPercent: pct(grossProfit, netKnown),
    discounts: money(total((r) => r.disc)),
    // Courier and payment fees belong to whole orders, not to products.
    contributionProfit: null,
  };
}
