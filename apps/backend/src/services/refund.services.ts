import { prisma } from "@repo/db/client";
import { Decimal } from "decimal.js";
import { initiateRazorpayRefund } from "../utils/razorpay.client";
import { createAuditLog } from "../utils/auditLog";
import { notify, notifyAdmins } from "./notification.services";
import { money, orderShortRef } from "../utils/notificationCopy";
import { REFUND_WORKING_DAYS } from "@repo/content/index";

/**
 * Which of an order's captured legs to return.
 *
 * A Payment can hold two separate captures: the primary leg (`amount` — a full payment,
 * or a partial order's deposit) and the balance leg (`balanceAmount`). Cancellation policy
 * differs per leg and per who cancelled, so the caller states its intent rather than
 * letting this function guess:
 *
 *  - ALL          merchant-initiated cancellation, or any cancelled full-payment order
 *  - BALANCE_ONLY the deposit is forfeited but a paid balance must still be returned
 *                 (RTO or customer cancellation after the balance was settled)
 *  - NONE         the deposit is forfeited and nothing was collected beyond it
 */
export type RefundScope = "ALL" | "BALANCE_ONLY" | "NONE";

export type RefundOutcome =
  | { status: "none" }
  | { status: "initiated"; amount: number }
  | { status: "failed"; amount: number }
  | { status: "forfeited"; amount: number };

/** Razorpay rejects refunds below ₹1; calling anyway logs a permanent REFUND_FAILED. */
const MIN_REFUND = 1;

type Leg = {
  name: "primary" | "balance";
  razorpayPaymentId: string;
  amount: number;
};

/**
 * Return captured money to the customer when their order is cancelled, returned or RTO'd.
 *
 * This is the single path the customer cancel (`cancelOrderService`), the admin cancel
 * (`updateOrderStatusService`) and the RTO webhook all use, so the three can never diverge.
 *
 * It refunds **every captured leg in scope**, not just `payment.amount`. The old
 * single-leg version under-refunded any order carrying a second capture — which a
 * pre-order-converted order already did, silently keeping the booking amount.
 *
 * Runs OUTSIDE the caller's transaction, deliberately: it makes external HTTP calls, and
 * holding a row-locked order transaction open across Razorpay is what turns a slow gateway
 * into pool exhaustion. The caller commits first, then calls this.
 *
 * Never throws. A cancellation that succeeded must not be reported as a failure because
 * the gateway was down.
 */
export async function refundOrderMoney(
  orderId: string,
  reason: string,
  opts: { scope?: RefundScope } = {}
): Promise<RefundOutcome> {
  const scope = opts.scope ?? "ALL";

  const payment = await prisma.payment.findUnique({
    where: { orderId },
    select: {
      id: true,
      method: true,
      status: true,
      amount: true,
      balanceAmount: true,
      razorpayPaymentId: true,
      balanceRazorpayPaymentId: true,
      balanceSettledAt: true,
      balanceMethod: true,
      order: { select: { userId: true, paymentPlan: true, depositForfeitedAt: true } },
    },
  });

  // Nothing to return: COD is collected on delivery, so a cancelled legacy COD order was
  // never paid (the cancel transaction closes its PENDING payment), and an unpaid/failed
  // online attempt never took money either.
  if (!payment || payment.method !== "ONLINE") return { status: "none" };

  const deposit = Number(payment.amount);

  // The deposit stays with us. Record why, once, so the forfeiture is auditable and the
  // customer-facing copy can name a reason.
  if (scope === "NONE" || scope === "BALANCE_ONLY") {
    if (payment.order.paymentPlan === "PARTIAL" && !payment.order.depositForfeitedAt) {
      await prisma.order.updateMany({
        where: { id: orderId, depositForfeitedAt: null },
        data: { depositForfeitedAt: new Date(), depositForfeitReason: reason },
      });
      await createAuditLog({
        action: "DEPOSIT_FORFEITED",
        entity: "Order",
        entityId: orderId,
        newValue: { amount: deposit, reason },
      });
    }
    if (scope === "NONE") return { status: "forfeited", amount: deposit };
  }

  // A balance collected as cash or recorded by hand has no gateway capture to reverse.
  // It becomes an explicit payout the admin owes, rather than silently disappearing.
  // (Scope NONE already returned above, so only ALL and BALANCE_ONLY reach here.)
  if (
    payment.balanceSettledAt &&
    !payment.balanceRazorpayPaymentId &&
    payment.balanceAmount
  ) {
    await prisma.payment.updateMany({
      where: { id: payment.id, manualRefundAmount: null },
      data: { manualRefundAmount: payment.balanceAmount },
    });
    await createAuditLog({
      action: "MANUAL_REFUND_OWED",
      entity: "Payment",
      entityId: orderId,
      newValue: {
        amount: Number(payment.balanceAmount),
        collectedVia: payment.balanceMethod,
        reason,
      },
    });
    void notifyAdmins({
      type: "ADMIN_CUSTOM",
      title: "Manual refund owed 💸",
      body: `Order #${orderShortRef(orderId)} needs ${money(
        Number(payment.balanceAmount)
      )} returned by hand — that balance was collected as ${
        payment.balanceMethod === "COD" ? "cash on delivery" : "a manual payment"
      }, so Razorpay cannot reverse it.`,
      data: { screen: "AdminOrder", orderId },
    });
  }

  // Which legs actually took money through the gateway and are in scope.
  const legs: Leg[] = [];
  if (scope === "ALL" && payment.razorpayPaymentId) {
    legs.push({ name: "primary", razorpayPaymentId: payment.razorpayPaymentId, amount: deposit });
  }
  if (payment.balanceRazorpayPaymentId && payment.balanceAmount) {
    legs.push({
      name: "balance",
      razorpayPaymentId: payment.balanceRazorpayPaymentId,
      amount: Number(payment.balanceAmount),
    });
  }

  const refundable = legs.filter((l) => l.amount >= MIN_REFUND);
  const tooSmall = legs.filter((l) => l.amount < MIN_REFUND);
  for (const l of tooSmall) {
    // Below Razorpay's floor the API 400s and the row logs REFUND_FAILED forever.
    await createAuditLog({
      action: "REFUND_SKIPPED_BELOW_MINIMUM",
      entity: "Payment",
      entityId: orderId,
      newValue: { leg: l.name, amount: l.amount, reason },
    });
  }

  if (refundable.length === 0) {
    return scope === "BALANCE_ONLY" ? { status: "forfeited", amount: deposit } : { status: "none" };
  }

  // Claim the refund atomically. Two admins cancelling the same order at once — or an
  // admin racing the customer — must produce exactly one set of calls to Razorpay.
  // PARTIALLY_PAID is claimable too: a deposit-paid order holds real money.
  const claimed = await prisma.payment.updateMany({
    where: { id: payment.id, status: { in: ["SUCCESS", "PARTIALLY_PAID"] } },
    data: { status: "REFUND_INITIATED", refundReason: reason },
  });
  if (claimed.count === 0) return { status: "none" };

  let refundedTotal = 0;
  let anyFailed = false;

  for (const leg of refundable) {
    try {
      const refund = await initiateRazorpayRefund({
        paymentId: leg.razorpayPaymentId,
        amount: leg.amount,
        notes: { orderId, reason, leg: leg.name },
      });

      await prisma.payment.update({
        where: { id: payment.id },
        data:
          leg.name === "primary"
            ? { refundId: refund.id, refundAmount: new Decimal(leg.amount) }
            : { balanceRefundId: refund.id, balanceRefundAmount: new Decimal(leg.amount) },
      });

      await createAuditLog({
        action: "REFUND_INITIATED",
        entity: "Payment",
        entityId: orderId,
        newValue: { refundId: refund.id, amount: leg.amount, leg: leg.name, reason, source: "cancellation" },
      });

      refundedTotal += leg.amount;
    } catch (err: any) {
      // Left at REFUND_INITIATED on purpose. Razorpay refunds are not idempotent, so
      // resetting would let a retry refund twice when the failure was only a lost
      // response. A human settles it from the audit row instead. This is the policy for
      // every refund path in this codebase.
      anyFailed = true;

      await createAuditLog({
        action: "REFUND_FAILED",
        entity: "Payment",
        entityId: orderId,
        newValue: {
          amount: leg.amount, leg: leg.name, reason,
          error: String(err?.message ?? err).slice(0, 300),
        },
      });

      void notifyAdmins({
        type: "ADMIN_CUSTOM",
        title: "Manual refund needed ⚠️",
        body: `Order #${orderShortRef(orderId)} was cancelled but the automatic refund of ${money(
          leg.amount
        )} (${leg.name} payment) failed. Refund it manually in Razorpay.`,
        data: { screen: "AdminOrder", orderId },
      });
    }
  }

  if (refundedTotal > 0) {
    void notify({
      userId: payment.order.userId,
      type: "REFUND_PROCESSED",
      title: "Refund on its way 💸",
      // Wording comes from @repo/content so the notification, both storefronts and the
      // cancellation policy page cannot quote three different windows.
      body: `Your refund of ${money(refundedTotal)} for the cancelled order #${orderShortRef(
        orderId
      )} has been initiated. It should reach you within ${REFUND_WORKING_DAYS} working days.`,
      data: { screen: "Order", orderId },
    });
  }

  if (refundedTotal === 0 && anyFailed) {
    return { status: "failed", amount: refundable.reduce((s, l) => s + l.amount, 0) };
  }
  return { status: "initiated", amount: refundedTotal };
}

