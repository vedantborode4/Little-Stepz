import { prisma } from "@repo/db/client";
import {
  PENDING_ORDER_TTL_MS,
  releasePendingOrderStock,
  stalePendingOrderWhere,
} from "../utils/pendingRelease";
import { releasePreOrderSlots } from "../utils/preOrderTerms";

/**
 * Time-based release of inventory held by checkouts that were never paid for.
 *
 * Stock is decremented when the order is created, before Razorpay opens, so a
 * PENDING order holds real units. `reclaimStalePendingOrders` in orders.services.ts
 * already frees them — but only inside another order-creation transaction, and only
 * for that order's products. That makes release demand-driven, and the demand is
 * exactly what the held stock prevents: abandon the last unit of a product and it
 * reads "out of stock" to everyone, so nobody can place the order that would
 * trigger the reclaim. The stock never comes back.
 *
 * This sweeper is the fix. It runs on a timer with no product filter, so release
 * depends on nothing but the clock.
 */

const INTERVAL_MS = Number(process.env.STOCK_SWEEP_INTERVAL_MS ?? 60_000);
const BATCH_SIZE  = Number(process.env.STOCK_SWEEP_BATCH ?? 100);

/**
 * Release stale never-paid orders. Each order gets its own short transaction: a
 * batch-wide one would hold row locks across every product in the batch while
 * competing with live checkouts, and one bad row would lose the whole sweep.
 *
 * Safe to run concurrently with itself and with the lazy reaper — every release
 * re-asserts `status: 'PENDING'` atomically, so of two racers exactly one wins and
 * the loser is a no-op. That also makes this correct if the API is ever scaled to
 * multiple replicas.
 */
export async function sweepStalePendingOrders(): Promise<number> {
  const stale = await prisma.order.findMany({
    where: stalePendingOrderWhere(),
    select: { id: true },
    take: BATCH_SIZE,
    orderBy: { createdAt: "asc" },
  });

  let released = 0;
  for (const order of stale) {
    try {
      const didRelease = await prisma.$transaction((tx) =>
        releasePendingOrderStock(tx, order.id)
      );
      if (didRelease) released++;
    } catch (err) {
      console.error(`[sweeper] failed to release order ${order.id}:`, err);
    }
  }
  return released;
}

/**
 * The same starvation exists for pre-order capacity: `preOrderCount` slots held by
 * never-paid bookings are only reclaimed when someone books the same product, and
 * an overdue balance is only expired when someone happens to read that pre-order.
 */
export async function sweepStalePreOrders(): Promise<number> {
  const now = new Date();
  let released = 0;

  const staleBookings = await prisma.preOrder.findMany({
    where: {
      status: "PENDING_BOOKING",
      deletedAt: null,
      createdAt: { lt: new Date(now.getTime() - PENDING_ORDER_TTL_MS) },
    },
    select: { id: true, productId: true, variantId: true, quantity: true },
    take: BATCH_SIZE,
    orderBy: { createdAt: "asc" },
  });

  const overdueBalances = await prisma.preOrder.findMany({
    where: {
      status: "AWAITING_BALANCE",
      deletedAt: null,
      balanceDueAt: { lt: now },
    },
    select: { id: true, productId: true, variantId: true, quantity: true },
    take: BATCH_SIZE,
    orderBy: { balanceDueAt: "asc" },
  });

  const work = [
    ...staleBookings.map((p) => ({ ...p, from: "PENDING_BOOKING" as const, to: "CANCELLED" as const })),
    ...overdueBalances.map((p) => ({ ...p, from: "AWAITING_BALANCE" as const, to: "EXPIRED" as const })),
  ];

  for (const po of work) {
    try {
      const didRelease = await prisma.$transaction(async (tx) => {
        // Same atomic claim as the order path — a balance payment may be landing
        // right now, and it must not lose its slot underneath it.
        const claimed = await tx.preOrder.updateMany({
          where: { id: po.id, status: po.from },
          data: { status: po.to },
        });
        if (claimed.count === 0) return false;

        await releasePreOrderSlots(tx, [
          { productId: po.productId, variantId: po.variantId ?? null, quantity: po.quantity },
        ]);
        return true;
      });
      if (didRelease) released++;
    } catch (err) {
      console.error(`[sweeper] failed to release pre-order ${po.id}:`, err);
    }
  }

  return released;
}

export async function runStockSweep(): Promise<{ orders: number; preOrders: number }> {
  const orders    = await sweepStalePendingOrders();
  const preOrders = await sweepStalePreOrders();
  if (orders || preOrders) {
    console.log(`[sweeper] released ${orders} order(s), ${preOrders} pre-order slot(s)`);
  }
  return { orders, preOrders };
}

/**
 * Start the periodic sweep. Set `STOCK_SWEEP_ENABLED=false` to turn it off without
 * a redeploy — the fastest rollback if it ever misbehaves in production.
 */
export function startStockSweeper(): void {
  if (process.env.STOCK_SWEEP_ENABLED === "false") {
    console.log("[sweeper] disabled via STOCK_SWEEP_ENABLED=false");
    return;
  }

  const tick = () => {
    // Fail-soft: a sweep that throws must never take the API process down.
    void runStockSweep().catch((err) => console.error("[sweeper] sweep failed:", err));
  };

  // `unref` so the timer never keeps the process alive during a shutdown.
  setInterval(tick, INTERVAL_MS).unref();
  console.log(
    `[sweeper] running every ${INTERVAL_MS}ms, releasing orders unpaid for ${PENDING_ORDER_TTL_MS / 60000}min`
  );
}
