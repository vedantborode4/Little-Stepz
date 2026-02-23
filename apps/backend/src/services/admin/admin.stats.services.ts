import { prisma } from "@repo/db/client";
import type { AdminStatsQuery } from "@repo/zod-schema/index";

export async function adminGetStatsService(query: AdminStatsQuery) {
  const now   = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const startOf7d  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
  const startOf30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const rangeFrom = query.from ? new Date(query.from) : startOf30d;
  const rangeTo   = query.to   ? new Date(query.to)   : now;
  const rangeFilter = { gte: rangeFrom, lte: rangeTo };

  const [
    totalOrders, ordersToday, ordersThisWeek, ordersByStatus, ordersRevenue,
    paymentsSuccess, paymentsFailed, revenueLast30d,
    totalUsers, newUsersToday, newUsersThisWeek,
    totalProducts, lowStockProducts,
    totalAffiliates, pendingAffiliates,
    commissionsPending, commissionsApproved,
    pendingReturns, revenueChart, topProducts,
  ] = await Promise.all([
    prisma.order.count({ where: { deletedAt: null } }),
    prisma.order.count({ where: { deletedAt: null, createdAt: { gte: today } } }),
    prisma.order.count({ where: { deletedAt: null, createdAt: { gte: startOf7d } } }),
    prisma.order.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { id: true } }),
    prisma.order.aggregate({ where: { deletedAt: null, createdAt: rangeFilter }, _sum: { total: true }, _avg: { total: true }, _count: { id: true } }),
    prisma.payment.count({ where: { status: "SUCCESS", deletedAt: null } }),
    prisma.payment.count({ where: { status: "FAILED",  deletedAt: null } }),
    prisma.payment.aggregate({ where: { status: "SUCCESS", deletedAt: null, createdAt: rangeFilter }, _sum: { amount: true } }),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null, createdAt: { gte: today } } }),
    prisma.user.count({ where: { deletedAt: null, createdAt: { gte: startOf7d } } }),
    prisma.product.count({ where: { deletedAt: null } }),
    prisma.product.count({ where: { deletedAt: null, quantity: { lte: 5 }, inStock: true } }),
    prisma.affiliate.count({ where: { deletedAt: null } }),
    prisma.affiliate.count({ where: { deletedAt: null, status: "PENDING" } }),
    prisma.commission.aggregate({ where: { deletedAt: null, status: "PENDING" }, _sum: { amount: true }, _count: { id: true } }),
    prisma.commission.aggregate({ where: { deletedAt: null, status: "APPROVED" }, _sum: { amount: true }, _count: { id: true } }),
    prisma.return.count({ where: { status: "PENDING" } }),
    prisma.$queryRaw<Array<{ day: string; revenue: string; orders: string }>>`
      SELECT DATE("createdAt") AS day,
             COALESCE(SUM(total),0)::TEXT AS revenue,
             COUNT(id)::TEXT             AS orders
      FROM "Order"
      WHERE "deletedAt" IS NULL
        AND "createdAt" >= ${startOf30d}
        AND "createdAt" <= ${now}
      GROUP BY DATE("createdAt")
      ORDER BY day ASC`,
    prisma.orderItem.groupBy({
      by: ["productId"], _sum: { quantity: true }, _count: { id: true },
      orderBy: { _sum: { quantity: "desc" } }, take: 5,
    }),
  ]);

  const topProductIds = topProducts.map((p) => p.productId);
  const productNames  = await prisma.product.findMany({
    where: { id: { in: topProductIds } },
    select: { id: true, name: true, slug: true },
  });
  const productMap = new Map(productNames.map((p) => [p.id, p]));

  return {
    kpis: {
      totalOrders, ordersToday, ordersThisWeek,
      totalRevenue:   ordersRevenue._sum.total?.toNumber()   ?? 0,
      avgOrderValue:  ordersRevenue._avg.total?.toNumber()   ?? 0,
      revenueLast30d: revenueLast30d._sum.amount?.toNumber() ?? 0,
      totalUsers, newUsersToday, newUsersThisWeek,
      totalProducts, lowStockProducts,
      totalAffiliates, pendingAffiliates, pendingReturns,
    },
    payments: {
      totalSuccess: paymentsSuccess,
      totalFailed:  paymentsFailed,
      successRate:
        paymentsSuccess + paymentsFailed > 0
          ? ((paymentsSuccess / (paymentsSuccess + paymentsFailed)) * 100).toFixed(2) + "%"
          : "N/A",
    },
    commissions: {
      pending:  { count: commissionsPending._count.id,  amount: commissionsPending._sum.amount?.toNumber()  ?? 0 },
      approved: { count: commissionsApproved._count.id, amount: commissionsApproved._sum.amount?.toNumber() ?? 0 },
    },
    ordersByStatus: ordersByStatus.reduce((acc, r) => ({ ...acc, [r.status]: r._count.id }), {} as Record<string, number>),
    revenueChart: revenueChart.map((r) => ({
      day: r.day, revenue: parseFloat(r.revenue), orders: parseInt(r.orders, 10),
    })),
    topProducts: topProducts.map((p) => {
      const prod = productMap.get(p.productId);
      return { productId: p.productId, name: prod?.name ?? "Unknown", slug: prod?.slug ?? "", totalQuantity: p._sum.quantity ?? 0, totalOrders: p._count.id };
    }),
    meta: { rangeFrom: rangeFrom.toISOString(), rangeTo: rangeTo.toISOString(), generatedAt: now.toISOString() },
  };
}
