import { prisma } from "@repo/db/client";
import { processAffiliateCommissionService } from "./affiliate.services";
import { createAuditLogInTx } from "../utils/auditLog";
import { notify } from "./notification.services";
import { money } from "../utils/notificationCopy";

/**
 * Book the money for a COD order at the moment it is delivered.
 *
 * `Payment.status = SUCCESS` was only ever set on online paths (verify,
 * payment.captured, pre-order balance), so a COD payment created as PENDING stayed
 * PENDING forever — even after delivery. Two consequences: COD sales never counted
 * as revenue anywhere that filters on SUCCESS, and affiliates earned nothing on COD
 * because commission is created alongside payment success.
 *
 * Delivery — not COD confirmation — is the right moment: it is when the cash is
 * actually collected, which is what makes this equivalent to an online capture.
 * Booking at confirmation would pay commission on parcels that later RTO and never
 * earn a rupee.
 *
 * Idempotent by construction: the commission is only created on the transition that
 * actually flips PENDING → SUCCESS, so replayed courier webhooks are no-ops.
 */
export async function settleCodOnDelivery(orderId: string): Promise<void> {
  const commission = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        userId: true,
        total: true,
        affiliateId: true,
        payment: { select: { id: true, method: true, status: true } },
      },
    });

    const payment = order?.payment;
    if (!order || !payment || payment.method !== "COD" || payment.status !== "PENDING") {
      return null;
    }

    // Conditional update doubles as the idempotency guard — a second delivery
    // webhook finds nothing in PENDING and claims nothing.
    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: "SUCCESS" },
    });
    if (claimed.count === 0) return null;

    await createAuditLogInTx(tx, {
      action: "PAYMENT_SUCCESS",
      entity: "Payment",
      entityId: orderId,
      oldValue: { status: "PENDING" },
      newValue: { status: "SUCCESS", method: "COD", source: "delivery" },
    });

    if (!order.affiliateId) return null;

    return processAffiliateCommissionService({
      tx,
      orderId,
      affiliateId: order.affiliateId,
      orderTotal: Number(order.total),
      userId: order.userId,
    });
  });

  if (commission) {
    void notify({
      userId: commission.affiliateUserId,
      type: "COMMISSION_EARNED",
      title: "Commission earned 🎉",
      body: `You earned ${money(commission.amount)} commission on a referred order.`,
      data: { screen: "AffiliateEarnings", orderId },
    });
  }
}
