import { prisma, Prisma } from "@repo/db/client";
import { ApiError } from "../../utils/api";
import type {
  AdminCustomersQuery,
  AdminCartActivityQuery,
} from "@repo/zod-schema/index";

/**
 * Admin customer directory.
 *
 * "Total spend" counts only orders whose Payment reached SUCCESS. Counting every
 * order would inflate the figure with abandoned PENDING checkouts and with the
 * legacy COD orders whose payment is still PENDING because the parcel never
 * shipped — neither is money received.
 *
 * The list is one raw query rather than an ORM call plus per-row aggregates:
 * sorting by spend or order count has to happen in the database, otherwise the
 * "best customers" sort would only ever sort the current page.
 */

type CustomerRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: Date;
  isAffiliate: boolean;
  city: string | null;
  state: string | null;
  orders: bigint;
  spend: Prisma.Decimal | null;
  lastOrderAt: Date | null;
  total: bigint;
};

export async function listCustomersService(q: AdminCustomersQuery) {
  const skip = (q.page - 1) * q.limit;

  // Admins are staff, not customers — including them makes the directory
  // confusing and the counts wrong.
  const conditions: Prisma.Sql[] = [
    Prisma.sql`u."deletedAt" IS NULL`,
    Prisma.sql`u.role <> 'ADMIN'`,
  ];

  if (q.search) {
    const like = `%${q.search}%`;
    conditions.push(
      Prisma.sql`(u.name ILIKE ${like} OR u.email ILIKE ${like} OR u.phone ILIKE ${like})`
    );
  }

  if (q.segment === "affiliates") {
    conditions.push(
      Prisma.sql`EXISTS (SELECT 1 FROM "Affiliate" a WHERE a."userId" = u.id AND a."deletedAt" IS NULL)`
    );
  }

  // Paid-order existence, matching the spend definition above.
  const paidOrderExists = Prisma.sql`EXISTS (
    SELECT 1 FROM "Order" o2
    JOIN "Payment" p2 ON p2."orderId" = o2.id
    WHERE o2."userId" = u.id AND o2."deletedAt" IS NULL AND p2.status = 'SUCCESS'
  )`;
  if (q.segment === "with-orders") conditions.push(paidOrderExists);
  if (q.segment === "without-orders") conditions.push(Prisma.sql`NOT ${paidOrderExists}`);

  const where = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;

  const orderBy =
    q.sort === "oldest" ? Prisma.sql`u."createdAt" ASC`
    : q.sort === "name" ? Prisma.sql`u.name ASC`
    : q.sort === "spend" ? Prisma.sql`spend DESC, u."createdAt" DESC`
    : q.sort === "orders" ? Prisma.sql`orders DESC, u."createdAt" DESC`
    : Prisma.sql`u."createdAt" DESC`;

  const rows = await prisma.$queryRaw<CustomerRow[]>`
    SELECT
      u.id, u.name, u.email, u.phone, u."createdAt",
      EXISTS (SELECT 1 FROM "Affiliate" a WHERE a."userId" = u.id AND a."deletedAt" IS NULL) AS "isAffiliate",
      (SELECT ad.city  FROM "Address" ad WHERE ad."userId" = u.id AND ad."deletedAt" IS NULL ORDER BY ad."createdAt" DESC LIMIT 1) AS city,
      (SELECT ad.state FROM "Address" ad WHERE ad."userId" = u.id AND ad."deletedAt" IS NULL ORDER BY ad."createdAt" DESC LIMIT 1) AS state,
      COALESCE(agg.orders, 0)     AS orders,
      COALESCE(agg.spend, 0)      AS spend,
      agg."lastOrderAt"           AS "lastOrderAt",
      COUNT(*) OVER ()            AS total
    FROM "User" u
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::bigint AS orders, SUM(o.total) AS spend, MAX(o."createdAt") AS "lastOrderAt"
      FROM "Order" o
      JOIN "Payment" p ON p."orderId" = o.id
      WHERE o."userId" = u.id AND o."deletedAt" IS NULL AND p.status = 'SUCCESS'
    ) agg ON TRUE
    ${where}
    ORDER BY ${orderBy}
    LIMIT ${q.limit} OFFSET ${skip}
  `;

  const total = rows.length ? Number(rows[0]!.total) : 0;

  return {
    customers: rows.map((r) => {
      const orders = Number(r.orders);
      const spend = Number(r.spend ?? 0);
      return {
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        registeredAt: r.createdAt,
        isAffiliate: r.isAffiliate,
        city: r.city,
        state: r.state,
        orders,
        totalSpend: spend,
        // Average order value. Guarded rather than computed blindly: a customer
        // with zero paid orders would otherwise divide by zero and render NaN.
        aov: orders > 0 ? Number((spend / orders).toFixed(2)) : 0,
        lastOrderAt: r.lastOrderAt,
      };
    }),
    pagination: {
      page: q.page,
      limit: q.limit,
      total,
      totalPages: Math.ceil(total / q.limit),
    },
  };
}

export async function getCustomerService(id: string) {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      avatarUrl: true,
      emailVerified: true,
      createdAt: true,
      referralCode: true,
      referredBy: { select: { id: true, name: true, email: true } },
      affiliate: { select: { id: true, status: true, referralCode: true, commissionRate: true } },
      addresses: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true, name: true, phone: true, address: true, city: true,
          state: true, pincode: true, country: true, isDefault: true,
        },
      },
      // A preview for the table only — the lifetime stats below are aggregated
      // separately so they are never limited by this take.
      orders: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true, status: true, total: true, paymentMethod: true, createdAt: true,
          payment: { select: { status: true, method: true } },
          _count: { select: { items: true } },
        },
      },
      reviews: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true, rating: true, comment: true, createdAt: true,
          product: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });

  if (!user) throw new ApiError(404, "CUSTOMER_NOT_FOUND");

  // Aggregated over ALL of this customer's paid orders, not over the 50 fetched for
  // the table. Deriving the stats from that capped list made the detail page
  // contradict the list page for anyone with more than 50 orders.
  const paidWhere = {
    userId: id,
    deletedAt: null,
    payment: { is: { status: "SUCCESS" as const } },
  };
  const [paidAgg, lastPaid] = await Promise.all([
    prisma.order.aggregate({
      where: paidWhere,
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.order.findFirst({
      where: paidWhere,
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const paidCount = paidAgg._count._all;
  const totalSpend = Number(paidAgg._sum.total ?? 0);

  // Add-to-cart trail for this customer — the same events the activity list shows,
  // scoped to one person so an investigation starts here rather than in a global log.
  const cartActivity = await prisma.auditLog.findMany({
    where: { userId: id, action: "CART_ITEM_ADDED" },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: { id: true, entityId: true, newValue: true, metadata: true, createdAt: true },
  });

  return {
    ...user,
    stats: {
      orders: paidCount,
      totalSpend,
      aov: paidCount > 0 ? Number((totalSpend / paidCount).toFixed(2)) : 0,
      lastOrderAt: lastPaid?.createdAt ?? null,
    },
    cartActivity: await attachProducts(cartActivity),
  };
}

type ActivityRow = {
  id: string;
  entityId: string;
  newValue: unknown;
  metadata: unknown;
  createdAt: Date;
  userId?: string | null;
};

/**
 * AuditLog stores only the product id, so the rows are joined to product names in
 * one extra query. Done here rather than with a Prisma relation because AuditLog is
 * deliberately generic — it has no foreign key to Product.
 */
async function attachProducts(rows: ActivityRow[]) {
  const ids = [...new Set(rows.map((r) => r.entityId))];
  if (!ids.length) return [];

  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, slug: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  return rows.map((r) => {
    const value = (r.newValue ?? {}) as Record<string, unknown>;
    const meta = (r.metadata ?? {}) as Record<string, unknown>;
    return {
      id: r.id,
      createdAt: r.createdAt,
      product: byId.get(r.entityId) ?? { id: r.entityId, name: "(deleted product)", slug: null },
      variantId: (value.variantId as string | null) ?? null,
      quantity: (value.quantity as number | undefined) ?? 1,
      ip: (meta.ip as string | undefined) ?? null,
      userAgent: (meta.userAgent as string | undefined) ?? null,
      sessionId: (meta.sessionId as string | undefined) ?? null,
    };
  });
}

export async function listCartActivityService(q: AdminCartActivityQuery) {
  const skip = (q.page - 1) * q.limit;
  const where = {
    action: "CART_ITEM_ADDED",
    ...(q.userId ? { userId: q.userId } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: q.limit,
      select: {
        id: true, entityId: true, newValue: true, metadata: true, createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  const enriched = await attachProducts(rows as unknown as ActivityRow[]);

  return {
    events: enriched.map((e, i) => ({
      ...e,
      // Null user means a guest session — the sessionId is the only identity there.
      user: rows[i]?.user ?? null,
    })),
    pagination: {
      page: q.page,
      limit: q.limit,
      total,
      totalPages: Math.ceil(total / q.limit),
    },
  };
}
