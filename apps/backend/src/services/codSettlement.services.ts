import { prisma } from "@repo/db/client";
import { processAffiliateCommissionService } from "./affiliate.services";
import { createAuditLog, createAuditLogInTx } from "../utils/auditLog";
import { ApiError } from "../utils/api";
import { PaymentErrorCode } from "../utils/paymentErrors";
import { notify, notifyAdmins } from "./notification.services";
import { money, orderShortRef } from "../utils/notificationCopy";
import { sendDepositForfeitedEmail, sendOrderDeliveredEmail } from "../utils/email";
import { publicSiteUrl } from "../utils/siteUrl";

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

/**
 * Book a partial-payment order once every rupee of it is in.
 *
 * THE single accrual point. `Payment.status = SUCCESS` and the affiliate commission are
 * written here and nowhere else for a partial order, so neither can happen twice however
 * many channels report the money (the courier webhook, the admin marking it paid, an
 * online balance payment, or a replay of any of them).
 *
 * Settlement waits for DELIVERED even when the balance arrived earlier. That preserves the
 * rule the COD path already established — booking at confirmation pays commission on
 * parcels that later come back — which under partial payment stops being theoretical:
 * a customer who pays their balance online can still refuse the parcel.
 *
 * The GST invoice is NOT issued here. It is raised at dispatch, because a tax invoice must
 * accompany the goods (CGST §31(1)); settlement can be days later on a COD balance.
 */
export async function settleOrderIfFullyPaid(
  orderId: string,
  trigger: "delivery" | "balance-online" | "balance-manual"
): Promise<void> {
  let unmanifested = false;

  const commission = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        userId: true,
        total: true,
        status: true,
        affiliateId: true,
        paymentPlan: true,
        balanceAmount: true,
        dispatchLockedAt: true,
        payment: {
          select: { id: true, status: true, balanceSettledAt: true, balanceMethod: true },
        },
      },
    });

    const payment = order?.payment;
    if (!order || !payment) return null;
    if (order.paymentPlan !== "PARTIAL") return null;

    // The goods must actually be with the customer before any of this is earned.
    if (order.status !== "DELIVERED") return null;
    // Already settled, or the deposit never landed.
    if (payment.status !== "PARTIALLY_PAID") return null;

    // Delivered with the balance still outstanding means the courier collected it as cash
    // at the door — that is what a COD manifest is for. Record how it arrived.
    //
    // `codCollectedAt` is set here because the parcel was handed over. `codRemittedAt` is
    // deliberately NOT: delivery proves the parcel moved, only the remittance statement
    // proves the money did, and keeping the two apart is what makes an unremitted COD
    // visible instead of silently counted.
    if (!payment.balanceSettledAt) {
      // Only infer a doorstep collection when a COD parcel was actually committed.
      // `dispatchLockedAt` is set in the same act that manifests the shipment as COD, so
      // its absence means no courier was ever asked for money — the order reached
      // DELIVERED some other way, most likely an admin moving the status by hand. Booking
      // the balance there would flip the payment to SUCCESS and accrue affiliate
      // commission on money nobody collected.
      if (!order.dispatchLockedAt) {
        await createAuditLogInTx(tx, {
          action: "SETTLEMENT_FAILED",
          entity: "Payment",
          entityId: orderId,
          newValue: {
            trigger,
            reason: "DELIVERED with an outstanding balance but no COD parcel was manifested",
            balanceDue: Number(order.balanceAmount ?? 0),
          },
        });
        unmanifested = true;
        return null;
      }

      const claimedBalance = await tx.payment.updateMany({
        where: { id: payment.id, status: "PARTIALLY_PAID", balanceSettledAt: null },
        data: {
          balanceMethod: "COD",
          balanceSettledAt: new Date(),
          balancePaidAt: new Date(),
          codCollectedAt: new Date(),
        },
      });
      if (claimedBalance.count === 0) return null;

      await createAuditLogInTx(tx, {
        action: "BALANCE_COLLECTED_COD",
        entity: "Payment",
        entityId: orderId,
        newValue: { amount: Number(order.balanceAmount ?? 0), trigger },
      });
    }

    // The accrual claim. Exactly one caller can win this transition, which is what makes
    // the commission below fire at most once.
    const settled = await tx.payment.updateMany({
      where: { id: payment.id, status: "PARTIALLY_PAID" },
      data: { status: "SUCCESS" },
    });
    if (settled.count === 0) return null;

    await createAuditLogInTx(tx, {
      action: "ORDER_SETTLED",
      entity: "Payment",
      entityId: orderId,
      oldValue: { status: "PARTIALLY_PAID" },
      newValue: {
        status: "SUCCESS",
        trigger,
        balanceMethod: payment.balanceMethod ?? "COD",
        total: Number(order.total),
      },
    });

    if (!order.affiliateId) return null;

    // Commission is on the sale, so the base is the order total — not the balance leg.
    return processAffiliateCommissionService({
      tx,
      orderId,
      affiliateId: order.affiliateId,
      orderTotal: Number(order.total),
      userId: order.userId,
    });
  });

  if (unmanifested) {
    void notifyAdmins({
      type: "ADMIN_CUSTOM",
      title: "Delivered with an uncollected balance ⚠️",
      body: `Order #${orderShortRef(orderId)} is marked delivered but its balance was never manifested for collection. Confirm how the customer paid, then mark the balance settled — it is not booked, invoiced or commissioned until you do.`,
      data: { screen: "AdminOrder", orderId },
    });
  }

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

/**
 * Settle on delivery without ever failing the caller.
 *
 * The two call sites disagreed: the Delhivery webhook swallowed failures with
 * `.catch(console.error)` — so the event was still marked PROCESSED, the courier never
 * retried, and the money was silently never booked — while the admin status update left
 * it uncaught, 500-ing the admin *after* the status change had already committed.
 *
 * Neither is acceptable once settlement carries real weight (it books the payment, the
 * affiliate commission, and on partial orders the outstanding balance). Failing loudly to
 * the caller is wrong — the delivery genuinely happened — so the failure is recorded and
 * escalated instead, and surfaces in the "delivered but unsettled" report.
 */
export async function settleOnDeliverySafe(
  orderId: string,
  source: "webhook" | "admin"
): Promise<void> {
  try {
    // Legacy full-COD parcels still in the field, then partial-payment orders. Each is a
    // no-op for the other's shape, so both can run unconditionally.
    await settleCodOnDelivery(orderId);
    await settleOrderIfFullyPaid(orderId, "delivery");
  } catch (err: any) {
    console.error(`[settlement] failed for order ${orderId} (${source}):`, err);

    await createAuditLog({
      action: "SETTLEMENT_FAILED",
      entity: "Payment",
      entityId: orderId,
      newValue: { source, error: String(err?.message ?? err).slice(0, 300) },
    }).catch(() => {});

    void notifyAdmins({
      type: "ADMIN_CUSTOM",
      title: "Settlement failed on delivery ⚠️",
      body: `Order #${orderShortRef(orderId)} was delivered but could not be settled. Its payment, invoice and any affiliate commission are unbooked — settle it from the admin panel.`,
      data: { screen: "AdminOrder", orderId },
    });
  }
}

/**
 * Record a balance an admin collected outside the gateway.
 *
 * The escape hatch the other two channels need. A courier remits cash days late, a
 * customer pays by bank transfer, or an order reaches DELIVERED without ever having been
 * manifested for collection — in each case the money is real but nothing automatic can
 * see it, and until it is recorded the order stays unbooked, uninvoiced and
 * uncommissioned.
 *
 * The conditional update is the whole guard: it refuses an order whose balance is already
 * settled by any channel, so two admins clicking at once, or an admin racing a courier
 * webhook, produce exactly one settlement.
 */
export async function markBalancePaidService(
  orderId: string,
  adminUserId: string,
  body: { method: "CASH" | "BANK_TRANSFER" | "UPI" | "OTHER"; reference?: string; note?: string }
): Promise<{ orderId: string; balancePaid: number; settledAt: Date }> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, deletedAt: null },
    select: {
      paymentPlan: true,
      balanceAmount: true,
      payment: { select: { id: true, status: true, balanceSettledAt: true } },
    },
  });

  if (!order) throw new ApiError(404, PaymentErrorCode.ORDER_NOT_FOUND);
  if (order.paymentPlan !== "PARTIAL" || !order.payment) {
    throw new ApiError(400, PaymentErrorCode.BALANCE_NOT_DUE);
  }
  if (order.payment.balanceSettledAt || order.payment.status !== "PARTIALLY_PAID") {
    throw new ApiError(409, PaymentErrorCode.BALANCE_ALREADY_SETTLED);
  }

  const settledAt = new Date();
  const claimed = await prisma.payment.updateMany({
    where: { id: order.payment.id, status: "PARTIALLY_PAID", balanceSettledAt: null },
    data: {
      balanceMethod: "MANUAL",
      balanceSettledAt: settledAt,
      balancePaidAt: settledAt,
      balanceReference: body.reference ?? null,
    },
  });
  if (claimed.count === 0) throw new ApiError(409, PaymentErrorCode.BALANCE_ALREADY_SETTLED);

  await createAuditLog({
    userId: adminUserId,
    action: "BALANCE_MARKED_PAID",
    entity: "Payment",
    entityId: orderId,
    newValue: {
      amount: Number(order.balanceAmount ?? 0),
      method: body.method,
      reference: body.reference ?? null,
      note: body.note ?? null,
    },
  });

  // Books the payment, the commission and the invoice — but only once the goods are
  // actually with the customer. Recording an early settlement leaves the order correctly
  // marked as paid while delivery still gates the accrual.
  await settleOrderIfFullyPaid(orderId, "balance-manual");

  return { orderId, balancePaid: Number(order.balanceAmount ?? 0), settledAt };
}

/**
 * Write off a balance that will never be collected, and record the deposit as forfeited.
 *
 * The end state for an order that went out COD and came back, or that a customer simply
 * refused. It exists because the alternative — cancelling the order — implies stock came
 * back and money should move, neither of which is true here: the parcel's fate is already
 * recorded by the courier webhook, and this is only the money.
 *
 * Deliberately does NOT refund. A written-off balance means the goods were not accepted,
 * which is exactly the case the deposit covers. Where the merchant is at fault, cancel the
 * order as MERCHANT instead — that refunds in full.
 */
export async function writeOffBalanceService(
  orderId: string,
  adminUserId: string,
  body: { reason: string; note?: string }
): Promise<{ orderId: string; depositForfeited: number; balanceWrittenOff: number }> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, deletedAt: null },
    select: {
      paymentPlan: true,
      depositAmount: true,
      balanceAmount: true,
      depositForfeitedAt: true,
      user: { select: { email: true } },
      payment: { select: { id: true, status: true, balanceSettledAt: true } },
    },
  });

  if (!order) throw new ApiError(404, PaymentErrorCode.ORDER_NOT_FOUND);
  if (order.paymentPlan !== "PARTIAL" || !order.payment) {
    throw new ApiError(400, PaymentErrorCode.BALANCE_NOT_DUE);
  }
  if (order.payment.balanceSettledAt || order.payment.status !== "PARTIALLY_PAID") {
    throw new ApiError(409, PaymentErrorCode.BALANCE_ALREADY_SETTLED);
  }

  // Claimed so two admins cannot both write it off and double-notify the customer.
  const claimed = await prisma.order.updateMany({
    where: { id: orderId, depositForfeitedAt: null },
    data: { depositForfeitedAt: new Date(), depositForfeitReason: body.reason },
  });
  if (claimed.count === 0) throw new ApiError(409, PaymentErrorCode.BALANCE_ALREADY_SETTLED);

  const deposit = Number(order.depositAmount ?? 0);
  const balance = Number(order.balanceAmount ?? 0);

  await createAuditLog({
    userId: adminUserId,
    action: "DEPOSIT_FORFEITED",
    entity: "Order",
    entityId: orderId,
    newValue: { amount: deposit, balanceWrittenOff: balance, reason: body.reason, note: body.note ?? null },
  });

  void notify({
    userId: (await prisma.order.findUnique({ where: { id: orderId }, select: { userId: true } }))!.userId,
    type: "ORDER_CANCELLED",
    title: "Order closed — deposit retained",
    body: `Order #${orderShortRef(orderId)} has been closed. As set out in our cancellation policy, the ${money(deposit)} deposit is retained.`,
    data: { screen: "Order", orderId },
  });

  if (order.user?.email) {
    void sendDepositForfeitedEmail(order.user.email, {
      orderId,
      deposit,
      reason: body.reason,
      policyUrl: publicSiteUrl() ? `${publicSiteUrl()}/cancellation` : undefined,
    });
  }

  return { orderId, depositForfeited: deposit, balanceWrittenOff: balance };
}

/**
 * Tell the customer their order arrived.
 *
 * Called from the two places that own a real DELIVERED *transition* — the admin status
 * change and the courier webhook's own transition guard — rather than from
 * settleOnDeliverySafe. Settlement is deliberately idempotent and re-runs on every
 * repeated "delivered" scan Delhivery sends; an email is not idempotent, so hanging it
 * there would mail the customer again on each replay.
 */
export async function emailOrderDelivered(orderId: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, total: true, user: { select: { email: true } } },
    });
    if (!order?.user?.email) return;

    void sendOrderDeliveredEmail(order.user.email, {
      orderId: order.id,
      total: Number(order.total),
    });
  } catch (err) {
    console.error(`[email] delivered notice failed for order ${orderId}:`, err);
  }
}
