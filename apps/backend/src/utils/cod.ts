import { Decimal } from "decimal.js";
import type { Prisma } from "@repo/db/client";
import { ApiError } from "./api";
import { OrderErrorCode } from "./orderErrors";

/**
 * Cash on Delivery: the full order value collected in cash by the courier.
 *
 * Full COD carries the RTO risk that got it removed once — nothing is paid upfront, so a
 * refused parcel is a total loss of forward and return shipping. Every gate here exists to
 * bound that exposure, and each is enforced server-side twice: at order creation and again
 * when the order is confirmed.
 */

/** Global kill switch. */
export function isCodEnabled(): boolean {
  return (process.env.COD_ENABLED ?? "false").toLowerCase() === "true";
}

/** Order value above which COD is withheld — the cash-at-the-door exposure per parcel. */
export function maxCodOrderValue(): Decimal {
  const raw = Number(process.env.COD_MAX_AMOUNT ?? "10000");
  return Number.isFinite(raw) && raw > 0 ? new Decimal(raw) : new Decimal(10000);
}

/** Undelivered COD orders one customer may hold at once. */
export function maxOpenCodOrders(): number {
  const raw = Number(process.env.COD_MAX_OPEN_ORDERS ?? "2");
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 2;
}

/**
 * Refused COD deliveries before COD is hidden for that customer.
 *
 * Zero or less means never block, rather than blocking everyone: a literal 0 would make
 * `refused >= 0` true for every customer and withdraw COD from the entire base.
 */
export function codRefusalLimit(): number {
  const raw = Number(process.env.COD_BLOCK_AFTER_REFUSALS ?? "1");
  if (!Number.isFinite(raw)) return 1;
  return raw <= 0 ? Number.POSITIVE_INFINITY : Math.floor(raw);
}

/**
 * Whether every line in a cart allows COD. The product switch is the master and a variant
 * can only opt out — the same rule as pre-orders and partial payment.
 */
export function resolveCartCodEnabled(
  lines: Array<{ product: { codEnabled: boolean }; variant?: { codEnabled: boolean } | null }>
): boolean {
  return (
    lines.length > 0 &&
    lines.every((l) => l.product.codEnabled && (l.variant ? l.variant.codEnabled : true))
  );
}

/** COD orders confirmed but not yet delivered. PENDING is excluded — nothing is owed yet. */
export function openCodOrderWhere(userId: string): Prisma.OrderWhereInput {
  return {
    userId,
    paymentMethod: "COD",
    deletedAt: null,
    status: { in: ["CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY"] },
  };
}

/**
 * COD orders the courier brought back.
 *
 * A courier return (RTO) and a customer-requested return both end at RETURNED, but only a
 * customer return carries a Return row. Filtering on its absence counts refused and
 * undeliverable parcels without penalising someone who legitimately sent an item back —
 * and needs nothing written at RTO time.
 */
export function codRefusalWhere(userId: string): Prisma.OrderWhereInput {
  return {
    userId,
    paymentMethod: "COD",
    deletedAt: null,
    status: "RETURNED",
    returns: { none: {} },
  };
}

/**
 * The per-customer COD gates, run inside the caller's transaction.
 *
 * The customer row is locked before counting: a bare count() is a check-then-write gap
 * under READ COMMITTED, so two simultaneous checkouts would both pass a cap of one.
 */
export async function assertCodAllowed(
  tx: Prisma.TransactionClient,
  userId: string,
  total: Decimal
): Promise<void> {
  if (total.gt(maxCodOrderValue())) {
    throw new ApiError(400, OrderErrorCode.COD_ORDER_VALUE_EXCEEDED);
  }

  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;

  const refused = await tx.order.count({ where: codRefusalWhere(userId) });
  if (refused >= codRefusalLimit()) {
    throw new ApiError(400, OrderErrorCode.COD_BLOCKED);
  }

  const open = await tx.order.count({ where: openCodOrderWhere(userId) });
  if (open >= maxOpenCodOrders()) {
    throw new ApiError(400, OrderErrorCode.COD_LIMIT_REACHED);
  }
}
