import { prisma } from "@repo/db/client";
import { Decimal } from "decimal.js";
import { initiateRazorpayRefund } from "../utils/razorpay.client";
import { createAuditLog } from "../utils/auditLog";
import { notify, notifyAdmins } from "./notification.services";
import { money, orderShortRef } from "../utils/notificationCopy";
import { REFUND_WORKING_DAYS } from "@repo/content/index";

export type RefundOutcome =
  | { status: "none" }
  | { status: "initiated"; amount: number }
  | { status: "failed"; amount: number };

/**
 * Return a captured payment to the customer when their order is cancelled.
 *
 * Cancelling a CONFIRMED order used to restore stock and the coupon while leaving
 * a SUCCESS payment untouched — the customer's money simply stayed with us, with
 * no refund, no audit row and no notification. This is the single path both the
 * customer cancel (`cancelOrderService`) and the admin cancel
 * (`updateOrderStatusService`) use, so the two can never diverge again.
 *
 * Runs OUTSIDE the caller's transaction, deliberately: it makes an external HTTP
 * call, and holding a row-locked order transaction open across Razorpay is what
 * turns a slow gateway into pool exhaustion. The caller commits the cancellation
 * first, then calls this.
 *
 * Never throws. A cancellation that succeeded must not be reported as a failure
 * because the gateway was down.
 */
export async function refundCapturedOrderPayment(
  orderId: string,
  reason: string
): Promise<RefundOutcome> {
  const payment = await prisma.payment.findUnique({
    where: { orderId },
    select: {
      id: true,
      method: true,
      status: true,
      amount: true,
      razorpayPaymentId: true,
      order: { select: { userId: true } },
    },
  });

  // Nothing to return: COD is collected on delivery, so a cancelled COD order was
  // never paid (the cancel transaction closes its PENDING payment), and an
  // unpaid/failed online attempt never took money either.
  if (
    !payment ||
    payment.method !== "ONLINE" ||
    payment.status !== "SUCCESS" ||
    !payment.razorpayPaymentId
  ) {
    return { status: "none" };
  }

  // Claim the refund atomically. Two admins cancelling the same order at once — or
  // an admin racing the customer — must produce exactly one call to Razorpay.
  const claimed = await prisma.payment.updateMany({
    where: { id: payment.id, status: "SUCCESS" },
    data: { status: "REFUND_INITIATED", refundReason: reason },
  });
  if (claimed.count === 0) return { status: "none" };

  const amount = Number(payment.amount);

  try {
    const refund = await initiateRazorpayRefund({
      paymentId: payment.razorpayPaymentId,
      amount,
      notes: { orderId, reason },
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { refundId: refund.id, refundAmount: new Decimal(amount) },
    });

    await createAuditLog({
      action: "REFUND_INITIATED",
      entity: "Payment",
      entityId: orderId,
      newValue: { refundId: refund.id, amount, reason, source: "cancellation" },
    });

    void notify({
      userId: payment.order.userId,
      type: "REFUND_PROCESSED",
      title: "Refund on its way 💸",
      // Wording comes from @repo/content so the notification, both storefronts and
      // the cancellation policy page cannot quote three different windows.
      body: `Your refund of ${money(amount)} for the cancelled order #${orderShortRef(orderId)} has been initiated. It should reach you within ${REFUND_WORKING_DAYS} working days.`,
      data: { screen: "Order", orderId },
    });

    return { status: "initiated", amount };
  } catch (err: any) {
    // Left at REFUND_INITIATED on purpose. Razorpay refunds are not idempotent, so
    // resetting to SUCCESS would let a retry refund twice when the failure was only
    // a lost response. A human settles it from the audit row instead.
    await createAuditLog({
      action: "REFUND_FAILED",
      entity: "Payment",
      entityId: orderId,
      newValue: { amount, reason, error: String(err?.message ?? err).slice(0, 300) },
    });

    void notifyAdmins({
      type: "ADMIN_CUSTOM",
      title: "Manual refund needed ⚠️",
      body: `Order #${orderShortRef(orderId)} was cancelled but the automatic refund of ${money(amount)} failed. Refund it manually in Razorpay.`,
      data: { screen: "AdminOrder", orderId },
    });

    return { status: "failed", amount };
  }
}
