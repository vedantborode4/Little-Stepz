import { prisma } from "@repo/db/client";
import { createShipmentService } from "./payment.services";
import { notifyAdmins } from "./notification.services";
import { orderShortRef } from "../utils/notificationCopy";
import { createAuditLog } from "../utils/auditLog";

/**
 * Hand confirmed orders to Delhivery without waiting for an admin.
 *
 * `createShipmentService` was only ever reachable from `POST /admin/orders/:id/ship`,
 * so nothing was manifested until someone clicked Ship in the admin panel. Orders
 * sat at CONFIRMED indefinitely with no waybill and no tracking link, and the
 * customer's "Order is being packed" notification never fired.
 *
 * A sweeper rather than a call inside the payment transaction, for two reasons:
 * creating a shipment is an external HTTP call that must not run inside (or gate)
 * a payment commit, and a Delhivery outage must not fail an order that the
 * customer has already paid for. Here a failure just means the order is picked up
 * on the next tick.
 */

const INTERVAL_MS = Number(process.env.AUTO_SHIP_INTERVAL_MS ?? 60_000);
const BATCH_SIZE  = Number(process.env.AUTO_SHIP_BATCH ?? 25);

/**
 * Grace period before an order is manifested.
 *
 * Customers can cancel a CONFIRMED order (`cancelOrderService`), so manifesting
 * the instant payment lands would book a courier for parcels that are about to be
 * cancelled — and a booked waybill has to be cancelled with Delhivery separately.
 * A few minutes costs nothing operationally and removes that race.
 */
const DELAY_MS = Number(process.env.AUTO_SHIP_DELAY_MS ?? 5 * 60_000);

/**
 * Give up after this many failures for one order and let a human look. A
 * permanently unshippable order (address Delhivery rejects, unserviceable pincode)
 * would otherwise retry every tick forever.
 *
 * Counted from SHIPMENT_FAILED audit rows, not from Shipment rows:
 * `createShipmentService` throws before it writes anything when the Delhivery call
 * fails, so a failed attempt leaves no Shipment behind to count.
 */
const MAX_ATTEMPTS = Number(process.env.AUTO_SHIP_MAX_ATTEMPTS ?? 3);

/** Guards against a slow sweep overlapping the next tick and double-manifesting. */
let running = false;

export async function sweepUnshippedOrders(): Promise<number> {
  const cutoff = new Date(Date.now() - DELAY_MS);

  const candidates = await prisma.order.findMany({
    where: {
      status: "CONFIRMED",
      deletedAt: null,
      updatedAt: { lt: cutoff },
      // Nothing already booked with the courier. FAILED rows are ignored here for
      // the same reason createShipmentService ignores them — they represent a
      // cancelled or unsuccessful attempt, not a live parcel.
      shipments: { none: { status: { not: "FAILED" } } },
    },
    select: { id: true },
    take: BATCH_SIZE,
    orderBy: { createdAt: "asc" },
  });

  let shipped = 0;
  for (const order of candidates) {
    const priorFailures = await prisma.auditLog.count({
      where: { entity: "Order", entityId: order.id, action: "SHIPMENT_FAILED" },
    });
    if (priorFailures >= MAX_ATTEMPTS) continue;

    try {
      // No adminUserId: the audit log records this as a system action, which is
      // what it is. `createAuditLog` treats userId as optional.
      await createShipmentService(undefined as unknown as string, order.id);
      shipped++;
    } catch (err: any) {
      const attempts = priorFailures + 1;
      console.error(
        `[auto-ship] order ${order.id} failed (attempt ${attempts}/${MAX_ATTEMPTS}):`,
        err?.message ?? err
      );

      await createAuditLog({
        action: "SHIPMENT_FAILED",
        entity: "Order",
        entityId: order.id,
        newValue: { attempt: attempts, reason: err?.message ?? "unknown", source: "auto-ship" },
      });

      if (attempts >= MAX_ATTEMPTS) {
        void notifyAdmins({
          type: "ADMIN_CUSTOM",
          title: "Shipment needs attention 📦",
          body: `Order #${orderShortRef(order.id)} could not be handed to Delhivery after ${MAX_ATTEMPTS} attempts. Ship it manually.`,
          data: { screen: "AdminOrder", orderId: order.id },
        });
      }
    }
  }

  return shipped;
}

export async function runShipmentSweep(): Promise<number> {
  if (running) return 0;
  running = true;
  try {
    const shipped = await sweepUnshippedOrders();
    if (shipped) console.log(`[auto-ship] manifested ${shipped} order(s)`);
    return shipped;
  } finally {
    running = false;
  }
}

/**
 * Start the periodic sweep. `AUTO_SHIP_ENABLED=false` turns it off without a
 * redeploy, leaving the admin "Ship" button as the only path — the behaviour
 * before this existed.
 */
export function startShipmentSweeper(): void {
  if (process.env.AUTO_SHIP_ENABLED === "false") {
    console.log("[auto-ship] disabled via AUTO_SHIP_ENABLED=false");
    return;
  }

  const tick = () => {
    void runShipmentSweep().catch((err) =>
      console.error("[auto-ship] sweep failed:", err)
    );
  };

  setInterval(tick, INTERVAL_MS).unref();
  console.log(
    `[auto-ship] running every ${INTERVAL_MS}ms, manifesting orders confirmed over ${DELAY_MS / 60000}min ago`
  );
}
