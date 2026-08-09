import { Prisma } from "@repo/db/client";
import { syncProductStockFlags } from "./stock";

/**
 * How long a never-paid order may hold its stock.
 *
 * Stock is decremented at order creation (orders.services.ts), before Razorpay is
 * ever opened, so a PENDING order IS the reservation. This window is therefore the
 * only thing standing between an abandoned checkout and a product nobody else can
 * buy — keep it short. Raising it does not make a slow payer safer: a late capture
 * is handled by the confirmation guards in payment.services.ts, which refund rather
 * than oversell.
 */
export const PENDING_ORDER_TTL_MS =
  Number(process.env.PENDING_ORDER_TTL_MIN ?? 10) * 60 * 1000;

/**
 * Orders that are safe to reclaim: PENDING, past the TTL, and with no money moved.
 *
 * The payment filter is the important half. A COD order is flipped to CONFIRMED in
 * the same request so it is never PENDING this long, and an order whose payment
 * already reads SUCCESS must never be released no matter how old it looks.
 */
export function stalePendingOrderWhere(now: Date = new Date()): Prisma.OrderWhereInput {
  return {
    status: "PENDING",
    deletedAt: null,
    createdAt: { lt: new Date(now.getTime() - PENDING_ORDER_TTL_MS) },
    OR: [
      { payment: { is: null } },
      { payment: { status: { in: ["INITIATED", "FAILED"] } } },
    ],
  };
}

/**
 * Cancel a never-paid PENDING order and give back everything it was holding:
 * stock, the denormalized `inStock` flag, and the coupon use.
 *
 * Three callers need to undo an order-creation stock decrement — the lazy reaper in
 * orders.services.ts, the `payment.failed` webhook, and the sweeper — and they must
 * undo it identically, or the stock a product gets back depends on which path
 * happened to fire.
 *
 * The order is claimed with an atomic `updateMany` re-asserting `PENDING`. A
 * concurrent verify/webhook may be confirming this very order; if we lose that race
 * we return false and touch nothing, so stock is never handed back underneath an
 * order that still stands. Callers that win the claim get `true`.
 *
 * Callers are responsible for only passing orders whose money has not moved — see
 * `stalePendingOrderWhere`.
 */
export async function releasePendingOrderStock(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<boolean> {
  const claimed = await tx.order.updateMany({
    where: { id: orderId, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
  if (claimed.count === 0) return false;

  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      couponId: true,
      items: { select: { productId: true, variantId: true, quantity: true } },
    },
  });
  if (!order) return false;

  for (const item of order.items) {
    if (item.variantId) {
      await tx.variant.update({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } },
      });
    } else {
      await tx.product.update({
        where: { id: item.productId },
        data: { quantity: { increment: item.quantity } },
      });
    }
  }

  // Returning stock can bring a sold-out product back in stock.
  await syncProductStockFlags(tx, order.items.map((i) => i.productId));

  if (order.couponId) {
    await tx.coupon.updateMany({
      where: { id: order.couponId, usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  }

  await tx.payment.updateMany({
    where: { orderId, status: { in: ["INITIATED", "PENDING"] } },
    data: { status: "FAILED" },
  });

  return true;
}
