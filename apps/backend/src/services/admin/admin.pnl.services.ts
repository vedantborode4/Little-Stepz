import { prisma, OrderStatus, CommissionStatus } from "@repo/db/client";

// Estimate constants — overridable via env, defaults match the P&L reference design.
const COST_RATIO = Number(process.env.PNL_COST_RATIO ?? 0.58); // fallback product cost as a share of line revenue
const SHIPPING_PER_ORDER = Number(process.env.PNL_SHIPPING_PER_ORDER ?? 85);
const GST_RATE = Number(process.env.PNL_GST_RATE ?? 0); // 0 = no GST tracked

// "Paid & not cancelled" — revenue recognised and not reversed.
const COUNTED_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
  OrderStatus.RETURN_REQUESTED,
  OrderStatus.RETURN_APPROVED,
  OrderStatus.RETURN_REJECTED,
];

export type PnlRange = "today" | "7d" | "30d" | "6m" | "year" | "all";

function rangeStart(range: PnlRange): Date | null {
  const d = new Date();
  switch (range) {
    case "today": d.setHours(0, 0, 0, 0); return d;
    case "7d": d.setDate(d.getDate() - 7); return d;
    case "6m": d.setMonth(d.getMonth() - 6); return d;
    case "year": d.setFullYear(d.getFullYear() - 1); return d;
    case "all": return null;
    case "30d":
    default: d.setDate(d.getDate() - 30); return d;
  }
}

const orderWhere = (from: Date | null) => ({
  status: { in: COUNTED_STATUSES },
  ...(from ? { createdAt: { gte: from } } : {}),
});

type CostItem = { quantity: number; price: unknown; product: { costPrice: unknown } | null };

/** Actual purchase cost (costPrice × qty) when set, otherwise the estimate (line revenue × COST_RATIO). */
function itemsCost(items: CostItem[]): number {
  let cost = 0;
  for (const it of items) {
    const line = Number(it.price) * it.quantity;
    const cp = it.product?.costPrice != null ? Number(it.product.costPrice) : null;
    cost += cp != null ? cp * it.quantity : line * COST_RATIO;
  }
  return cost;
}

const gstOf = (revenue: number) => (GST_RATE > 0 ? (revenue * GST_RATE) / (1 + GST_RATE) : 0);

export async function getPnlService(range: PnlRange) {
  const from = rangeStart(range);

  const orders = await prisma.order.findMany({
    where: orderWhere(from),
    select: {
      total: true,
      discount: true,
      items: { select: { quantity: true, price: true, product: { select: { costPrice: true } } } },
    },
  });

  const orderCount = orders.length;
  const revenue = orders.reduce((s, o) => s + Number(o.total), 0);
  const discounts = orders.reduce((s, o) => s + Number(o.discount), 0);
  const gst = gstOf(revenue);
  const taxable = revenue - gst;
  const productCost = orders.reduce((s, o) => s + itemsCost(o.items), 0);
  const grossProfit = taxable - productCost;
  const shippingCost = SHIPPING_PER_ORDER * orderCount;

  const commAgg = await prisma.commission.aggregate({
    _sum: { amount: true },
    where: {
      status: { in: [CommissionStatus.APPROVED, CommissionStatus.PAID] },
      ...(from ? { createdAt: { gte: from } } : {}),
    },
  });
  const commissions = Number(commAgg._sum.amount ?? 0);

  // Discounts are already netted out of order totals — shown for transparency, not re-subtracted.
  const netProfit = grossProfit - shippingCost - commissions;
  const margin = revenue > 0 ? netProfit / revenue : 0;
  const hasActualCosts = orders.some((o) => o.items.some((it) => it.product?.costPrice != null));

  // ── Monthly series (last 6 calendar months, oldest → newest) ──────────────
  const monthsFrom = new Date();
  monthsFrom.setMonth(monthsFrom.getMonth() - 5);
  monthsFrom.setDate(1);
  monthsFrom.setHours(0, 0, 0, 0);

  const monthlyOrders = await prisma.order.findMany({
    where: orderWhere(monthsFrom),
    select: {
      total: true,
      createdAt: true,
      items: { select: { quantity: true, price: true, product: { select: { costPrice: true } } } },
    },
  });

  const buckets = Array.from({ length: 6 }, (_, i) => {
    const dt = new Date(monthsFrom.getFullYear(), monthsFrom.getMonth() + i, 1);
    return {
      key: `${dt.getFullYear()}-${dt.getMonth()}`,
      label: `${dt.toLocaleString("en-US", { month: "short" })} ${String(dt.getFullYear()).slice(2)}`,
      revenue: 0,
      grossProfit: 0,
    };
  });
  const indexByKey = new Map(buckets.map((b, i) => [b.key, i]));

  for (const o of monthlyOrders) {
    const dt = new Date(o.createdAt);
    const idx = indexByKey.get(`${dt.getFullYear()}-${dt.getMonth()}`);
    if (idx === undefined) continue;
    const rev = Number(o.total);
    const bucket = buckets[idx]!;
    bucket.revenue += rev;
    bucket.grossProfit += rev - gstOf(rev) - itemsCost(o.items);
  }

  return {
    range,
    orderCount,
    revenue,
    gst,
    taxable,
    productCost,
    grossProfit,
    shippingCost,
    commissions,
    discounts,
    netProfit,
    margin,
    hasActualCosts,
    costRatio: COST_RATIO,
    shippingPerOrder: SHIPPING_PER_ORDER,
    gstRate: GST_RATE,
    monthly: buckets.map((b) => ({
      label: b.label,
      revenue: Math.round(b.revenue),
      grossProfit: Math.round(b.grossProfit),
    })),
  };
}
