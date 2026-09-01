import { prisma, Prisma, PaymentStatus, OrderStatus, PaymentMethod, WebhookStatus, ReturnStatus } from "@repo/db/client";
import type { ShipmentStatus } from "@repo/db/client";
import { ApiError } from "../utils/api";
import { PaymentErrorCode } from "../utils/paymentErrors";
import { createAuditLog, createAuditLogInTx } from "../utils/auditLog";
import {
  createRazorpayOrder,
  verifyRazorpaySignature,
  initiateRazorpayRefund,
  fetchRazorpayPayment,
} from "../utils/razorpay.client";
import {
  createDelhiveryShipment,
  trackByWaybill,
  cancelDelhiveryShipment,
  mapDelhiveryStatus,
} from "../utils/delhivery.client";
import { processAffiliateCommissionService, reverseAffiliateCommissionsService } from "./affiliate.services";
import { reconcilePreOrderByRazorpayOrderId } from "./preorder.services";
import { notify, notifyAdmins } from "./notification.services";
import { REFUND_WORKING_DAYS } from "@repo/content/index";
import { sendNewOrderAdminEmail, sendOrderConfirmationEmail } from "../utils/email";
import { issueInvoiceForOrder, getInvoicePdfService, invoiceFileName } from "./invoice.services";
import { orderShortRef, money, orderStatusNotification } from "../utils/notificationCopy";
import { Decimal } from "decimal.js";
import type {
  CreatePaymentBody,
  VerifyPaymentBody,
  CreateReturnBody,
  ResolveReturnBody,
} from "@repo/zod-schema/index";
import { Request } from "express";
import { releasePendingOrderStock } from "../utils/pendingRelease";
import { settleOnDeliverySafe } from "./codSettlement.services";
import { refundOrderMoney, type RefundScope } from "./refund.services";
import { restoreOrderStock } from "../utils/stock";

const MAX_PAYMENT_ATTEMPTS = 3;
const TX_RETRIES           = 3;
const RETURN_WINDOW_DAYS   = 7; // Orders eligible for return within 7 days of delivery

/**
 * Fire-and-forget notifications for a freshly confirmed order. Fail-soft (notify
 * never throws). `paid` adds a payment-received notice for online payments; COD
 * orders are confirmed but not yet paid.
 */
function emitOrderConfirmed(
  userId: string,
  orderId: string,
  total: number | string,
  opts: {
    paid: boolean;
    /** Present when only a deposit was captured — the copy must say so. */
    partial?: { deposit: number; balanceDue: number };
  }
) {
  if (opts.paid) {
    void notify({
      userId,
      type: "PAYMENT_SUCCESS",
      title: opts.partial ? "Deposit received 💳" : "Payment received 💳",
      // Never quote the order total as "received" on a partial order — 20% was taken and
      // the rest is still owed at the door.
      body: opts.partial
        ? `We've received your deposit of ${money(opts.partial.deposit)} for order #${orderShortRef(orderId)}. ${money(opts.partial.balanceDue)} is due when your order is delivered.`
        : `We've received your payment of ${money(total)} for order #${orderShortRef(orderId)}.`,
      data: { screen: "Order", orderId },
    });
  }
  void notify({
    userId,
    type: "ORDER_CONFIRMED",
    title: "Order confirmed ✅",
    body: `Your order #${orderShortRef(orderId)} is confirmed and being prepared.`,
    data: { screen: "Order", orderId },
  });
  void notifyAdmins({
    type: "ADMIN_NEW_ORDER",
    title: "New order received 🛒",
    body: `Order #${orderShortRef(orderId)} — ${money(total)} — was just confirmed.`,
    data: { screen: "AdminOrder", orderId },
  });

  void emitOrderEmails(orderId);
}

/**
 * Order-confirmation emails: one to the customer, one to whoever runs the store.
 *
 * Separate from the notifications above because it needs to read the order back for
 * item names and the customer's address. Fire-and-forget and fail-soft like
 * `notify()` — `sendEmail` never throws, and a mail problem must not affect a
 * payment flow that has already committed.
 */
async function emitOrderEmails(orderId: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        total: true,
        paymentMethod: true,
        user: { select: { name: true, email: true } },
        items: { select: { productName: true, variantName: true, quantity: true } },
      },
    });

    if (!order) return;

    const items = order.items.map((i) => {
      // Snapshot names, so a later rename doesn't rewrite what the customer bought.
      // They're nullable on older rows, hence the fallback.
      const base = i.productName ?? "Item";
      return {
        name: i.variantName ? `${base} (${i.variantName})` : base,
        quantity: i.quantity,
      };
    });

    const payload = {
      orderId: order.id,
      total: order.total.toString(),
      paymentMethod: order.paymentMethod,
      items,
    };

    if (order.user?.email) {
      // The invoice rides along with the confirmation. Generated inside its own
      // try/catch because a PDF or numbering failure must still leave the customer
      // with a confirmation email — the invoice is recoverable from the download
      // endpoint, a missing confirmation is not.
      let invoice: { filename: string; pdf: Buffer; number: string } | undefined;
      try {
        const issued = await issueInvoiceForOrder(orderId);
        if (issued) {
          const { pdf, number } = await getInvoicePdfService(orderId);
          invoice = { filename: invoiceFileName(number), pdf, number };
        }
      } catch (err) {
        console.error(`[invoice] generation failed for order ${orderId}:`, err);
      }

      void sendOrderConfirmationEmail(order.user.email, { ...payload, ...(invoice ? { invoice } : {}) });
    }

    const recipients = await resolveAdminOrderEmails();
    if (recipients.length) {
      void sendNewOrderAdminEmail(recipients, {
        ...payload,
        customerName: order.user?.name ?? "a customer",
      });
    }
  } catch (err) {
    console.error(`[order-email] failed for order ${orderId}:`, err);
  }
}

/**
 * Who gets the new-order email. `ADMIN_ORDER_EMAIL` (comma-separated) wins so alerts
 * can go to an ops inbox; otherwise every active ADMIN account, which matches who
 * `notifyAdmins` already reaches.
 */
async function resolveAdminOrderEmails(): Promise<string[]> {
  const configured = process.env.ADMIN_ORDER_EMAIL;
  if (configured) {
    return configured.split(",").map((e) => e.trim()).filter(Boolean);
  }

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", deletedAt: null },
    select: { email: true },
  });

  return admins.map((a) => a.email).filter(Boolean);
}

/** Fire-and-forget commission-earned notification to the affiliate. Fail-soft. */
function emitCommissionEarned(
  commission: { affiliateUserId: string; amount: number } | null,
  orderId: string
) {
  if (!commission) return;
  void notify({
    userId: commission.affiliateUserId,
    type: "COMMISSION_EARNED",
    title: "Commission earned 🎉",
    body: `You earned ${money(commission.amount)} commission on a referred order.`,
    data: { screen: "AffiliateEarnings", orderId },
  });
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let attempts = 0;
  while (attempts < TX_RETRIES) {
    try {
      return await fn();
    } catch (err: any) {
      const isSerializationErr =
        err?.code === "P2034" ||
        err?.message?.includes("serialization failure") ||
        err?.message?.includes("could not serialize") ||
        err?.message?.includes("Transaction failed") ||
        // createPaymentService raises this when another request is mid-flight with
        // the gateway. Backing off and retrying lets the winner finish, after which
        // this attempt reuses its Razorpay order — which is what a double-clicked
        // "Proceed to Pay" used to get from blocking on the row lock.
        err?.message?.includes(PaymentErrorCode.CONCURRENCY_CONFLICT);

      if (isSerializationErr && attempts < TX_RETRIES - 1) {
        attempts++;
        const backoff = Math.pow(2, attempts) * 100 + Math.random() * 100;
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      throw err;
    }
  }
  throw new ApiError(500, PaymentErrorCode.CONCURRENCY_CONFLICT);
}

/**
 * Create (or reuse) the Razorpay order for a pending order.
 *
 * Split into claim → gateway call → record, so the external HTTP call does not run
 * inside a transaction holding `FOR UPDATE` locks on Order and Payment. Under load
 * that shape converts Razorpay latency straight into connection-pool exhaustion.
 *
 * The single-Razorpay-order guarantee is preserved by the claim: the first
 * transaction writes an INITIATED Payment row with `razorpayOrderId: null`, which is
 * the marker for "a gateway call is in flight". A concurrent request that sees it
 * backs off as a conflict (and `withRetry` retries it) rather than opening a second
 * checkout for the same order. If the gateway call fails the claim is released to
 * FAILED, so the customer can try again.
 */
export async function createPaymentService(
  userId: string,
  data: CreatePaymentBody,
  req?: Request
) {
  // ── 1. Claim, under lock. No external calls inside this transaction. ──────────
  const claim = await withRetry(async () => {
    return prisma.$transaction(async (tx) => {
      const orders = await tx.$queryRaw<Array<{
        id: string; userId: string; total: unknown;
        status: string; paymentMethod: string;
        paymentPlan: string; depositAmount: unknown; balanceAmount: unknown;
      }>>`
        SELECT id, "userId", total, status, "paymentMethod",
               "paymentPlan", "depositAmount", "balanceAmount"
        FROM "Order"
        WHERE id = ${data.orderId}
        FOR UPDATE
      `;

      const order = orders[0];
      if (!order) throw new ApiError(404, PaymentErrorCode.ORDER_NOT_FOUND);
      if (order.userId !== userId) throw new ApiError(403, PaymentErrorCode.UNAUTHORIZED_ACCESS);

      if (order.status !== "PENDING") {
        throw new ApiError(400, PaymentErrorCode.ORDER_NOT_PENDING);
      }
      // Deliberately no COD guard here. COD confirmation always flipped the order to
      // CONFIRMED in the same transaction that wrote the COD payment, so a PENDING
      // order can never carry a settled COD payment — and the status check above
      // already rejects a confirmed one. Since COD was withdrawn this also covers an
      // order created by a legacy client that intended COD: paying online must work,
      // because the order is replayed under the same idempotency key. The method is
      // corrected below.

      const isPartial = order.paymentPlan === "PARTIAL";

      // On a partial order this checkout charges only the deposit. The balance is a
      // separate leg, collected at the door or through its own payment later.
      const totalAmount = isPartial ? Number(order.depositAmount) : Number(order.total);
      const legBalance = isPartial ? new Decimal(String(order.balanceAmount ?? 0)) : null;

      // Razorpay rejects anything below ₹1. A coupon covering the whole subtotal
      // with free shipping produces a ₹0 total, which would leave the order stuck:
      // unpayable online and never confirmable. Not reachable with today's coupon
      // data, but the failure mode is a dead order, so guard it explicitly.
      if (!Number.isFinite(totalAmount) || totalAmount < 1) {
        throw new ApiError(400, PaymentErrorCode.AMOUNT_MISMATCH);
      }

      const existingPayment = await tx.payment.findUnique({
        where: { orderId: data.orderId },
      });

      if (existingPayment) {
        // PARTIALLY_PAID counts as succeeded for this purpose: the deposit is already
        // captured, and without this a second /payments/create would open a whole second
        // Razorpay order for the same deposit.
        if (existingPayment.status === "SUCCESS" || existingPayment.status === "PARTIALLY_PAID") {
          throw new ApiError(409, PaymentErrorCode.PAYMENT_ALREADY_SUCCEEDED);
        }
        if (existingPayment.attempts >= MAX_PAYMENT_ATTEMPTS) {
          throw new ApiError(429, PaymentErrorCode.PAYMENT_MAX_ATTEMPTS);
        }
        if (existingPayment.razorpayOrderId && existingPayment.status === "INITIATED") {
          // Reopening the sheet reuses the same Razorpay order — no gateway call.
            return {
            reuse: true as const,
            razorpayOrderId: existingPayment.razorpayOrderId,
            totalAmount,
            isPartial,
            balanceDue: Number(order.balanceAmount ?? 0),
          };
        }
        if (existingPayment.status === "INITIATED" && !existingPayment.razorpayOrderId) {
          // Another request is between the claim and the gateway response.
          throw new ApiError(500, PaymentErrorCode.CONCURRENCY_CONFLICT);
        }

        await tx.payment.update({
          where: { orderId: data.orderId },
          data: {
            attempts:        { increment: 1 },
            status:          "INITIATED",
            razorpayOrderId: null,
            // Re-assert the leg amounts: the order may have been created before the
            // payment row, and `amount` must always equal what this capture will take.
            amount:          new Decimal(totalAmount),
            balanceAmount:   legBalance,
          },
        });
      } else {
        await tx.payment.create({
          data: {
            orderId:         data.orderId,
            method:          "ONLINE",
            gateway:         "razorpay",
            // The deposit on a partial order, the whole total otherwise. Every downstream
            // amount check compares against this, never against `order.total`, which is
            // what lets a partial capture verify correctly with no other change.
            amount:          new Decimal(totalAmount),
            balanceAmount:   legBalance,
            currency:        "INR",
            status:          "INITIATED",
            attempts:        1,
          },
        });
      }

      // Keep the order's method truthful — it drives the Delhivery manifest
      // (COD vs Prepaid) and the shipping rate.
      if (order.paymentMethod !== "ONLINE") {
        await tx.order.update({
          where: { id: data.orderId },
          data:  { paymentMethod: "ONLINE" },
        });
      }

      return { reuse: false as const, totalAmount, isPartial, balanceDue: Number(order.balanceAmount ?? 0) };
    });
  });

  // `purpose` tells the client what it is about to charge, so the Razorpay sheet and the
  // verifying screen can say "20% deposit" rather than "Order Payment".
  const purpose = claim.isPartial ? ("DEPOSIT" as const) : ("FULL" as const);

  if (claim.reuse) {
    return {
      razorpayOrderId: claim.razorpayOrderId,
      orderId:         data.orderId,
      amount:          claim.totalAmount,
      currency:        "INR",
      keyId:           process.env.RAZORPAY_KEY_ID,
      purpose,
      balanceDue:      claim.balanceDue,
    };
  }

  // ── 2. Gateway call, outside any transaction. ────────────────────────────────
  let razorpayOrder;
  try {
    razorpayOrder = await createRazorpayOrder({
      amount:   claim.totalAmount,
      currency: "INR",
      receipt:  data.orderId.substring(0, 40),
      notes:    { orderId: data.orderId, userId, leg: claim.isPartial ? "deposit" : "full" },
    });
  } catch {
    // Release the claim, or the null razorpayOrderId would look like a permanently
    // in-flight request and every retry would conflict.
    await prisma.payment
      .updateMany({
        where: { orderId: data.orderId, status: "INITIATED", razorpayOrderId: null },
        data:  { status: "FAILED" },
      })
      .catch(() => {});
    throw new ApiError(502, PaymentErrorCode.RAZORPAY_ORDER_CREATE_FAILED);
  }

  // ── 3. Record the result. ────────────────────────────────────────────────────
  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { orderId: data.orderId },
      data: {
        razorpayOrderId: razorpayOrder.id,
        status:          "INITIATED",
        gatewayResponse: razorpayOrder as any,
      },
    });

    await createAuditLogInTx(tx, {
      userId,
      action:   "PAYMENT_INITIATED",
      entity:   "Payment",
      entityId: data.orderId,
      newValue: { razorpayOrderId: razorpayOrder.id, amount: claim.totalAmount },
      req,
    });
  });

  return {
    razorpayOrderId: razorpayOrder.id,
    orderId:         data.orderId,
    amount:          claim.totalAmount,
    currency:        "INR",
    keyId:           process.env.RAZORPAY_KEY_ID,
    purpose,
    balanceDue:      claim.balanceDue,
  };
}

/**
 * A capture arrived for an order that is no longer PENDING.
 *
 * Stock is decremented at order creation and handed back the moment a never-paid
 * order is cancelled (utils/pendingRelease.ts), so by the time we get here those
 * units are back in the catalogue and may already be sold to someone else.
 * Confirming would oversell, so the money goes straight back instead.
 *
 * Deliberately never throws. The payment has already left the customer's account;
 * recording `razorpayPaymentId` against our Payment row matters more than the
 * refund call succeeding. A refund we could not place is audit-logged as
 * REFUND_FAILED and left SUCCESS for an admin to settle by hand — throwing would
 * roll the transaction back and lose the only link between their money and us.
 */
async function refundOrphanedCapture(
  tx: Prisma.TransactionClient,
  params: {
    paymentId:         string;
    orderId:           string;
    razorpayPaymentId: string;
    amount:            number;
    orderStatus:       string;
    gatewayResponse:   unknown;
    source:            "verify" | "webhook";
    /**
     * Which capture this was. The primary leg owns `Payment.status`; the balance leg
     * must NOT touch it — overwriting a PARTIALLY_PAID payment here would erase the
     * record that a deposit is still held, and with it the ability to refund it.
     */
    leg?:              "primary" | "balance";
    reason?:           string;
  }
): Promise<{ refunded: boolean }> {
  const leg = params.leg ?? "primary";
  const reason = params.reason ?? "Order no longer active";

  let refundId: string | null = null;
  try {
    const refund = await initiateRazorpayRefund({
      paymentId: params.razorpayPaymentId,
      amount:    params.amount,
      notes:     { orderId: params.orderId, reason, leg },
    });
    refundId = refund.id;
  } catch {
    refundId = null;
  }

  // Record the capture either way. The money has already left the customer's account, so
  // the link between it and us matters more than the refund call succeeding.
  const captureData =
    leg === "primary"
      ? { razorpayPaymentId: params.razorpayPaymentId, gatewayResponse: params.gatewayResponse as any }
      : { balanceRazorpayPaymentId: params.razorpayPaymentId };

  // No refund placed on the primary leg: the capture stands and a human has to settle it,
  // so the status must say how much of the order that capture actually covers. A partial
  // order's deposit is NOT the full price, and marking it SUCCESS would report the order
  // as paid in full, hide it from the outstanding-balance reporting, and let the invoice
  // and commission gates fire on a deposit.
  let unrefundedStatus: "SUCCESS" | "PARTIALLY_PAID" = "SUCCESS";
  if (!refundId && leg === "primary") {
    const ord = await tx.order.findUnique({
      where: { id: params.orderId },
      select: { paymentPlan: true },
    });
    if (ord?.paymentPlan === "PARTIAL") unrefundedStatus = "PARTIALLY_PAID";
  }

  const refundData = refundId
    ? leg === "primary"
      ? {
          status:       "REFUND_INITIATED" as const,
          refundId,
          refundAmount: new Decimal(params.amount),
          refundReason: reason,
        }
      : {
          // No balanceRefundedAt: that column marks the refund as SETTLED and is written
          // only by the refund webhook. Setting it here would make the webhook read its
          // own work as a replay and drop it.
          balanceRefundId:     refundId,
          balanceRefundAmount: new Decimal(params.amount),
        }
    : leg === "primary"
      // No refund placed: leave the capture booked so an admin can settle it by hand.
      ? { status: unrefundedStatus }
      : {};

  await tx.payment.update({
    where: { id: params.paymentId },
    data: { ...captureData, ...refundData },
  });

  await createAuditLogInTx(tx, {
    action:   refundId ? "REFUND_INITIATED" : "REFUND_FAILED",
    entity:   "Payment",
    entityId: params.orderId,
    newValue: {
      reason:      "ORDER_NOT_PENDING",
      orderStatus: params.orderStatus,
      source:      params.source,
      leg,
      razorpayPaymentId: params.razorpayPaymentId,
      refundId,
      amount:      params.amount,
    },
  });

  return { refunded: refundId !== null };
}

/** Tell the customer their late payment was reversed rather than silently kept. */
function emitOrphanedCaptureNotice(userId: string, orderId: string, refunded: boolean) {
  void notify({
    userId,
    type:  refunded ? "REFUND_PROCESSED" : "PAYMENT_FAILED",
    title: refunded ? "Payment refunded 💸" : "Payment could not be applied",
    body:  refunded
      ? `Order #${orderShortRef(orderId)} had already been cancelled, so your payment has been refunded. It should reach you within ${REFUND_WORKING_DAYS} working days.`
      : `Order #${orderShortRef(orderId)} had already been cancelled and we couldn't apply your payment. Our team is on it and will refund you shortly.`,
    data: { screen: "Order", orderId },
  });
  if (!refunded) {
    void notifyAdmins({
      type:  "ADMIN_CUSTOM",
      title: "Manual refund needed ⚠️",
      body:  `A payment landed on cancelled order #${orderShortRef(orderId)} and the automatic refund failed.`,
      data:  { screen: "AdminOrder", orderId },
    });
  }
}

export async function verifyPaymentService(
  userId: string,
  data: VerifyPaymentBody,
  req?: Request
) {
  let signatureValid: boolean;
  try {
    signatureValid = verifyRazorpaySignature({
      razorpayOrderId:   data.razorpayOrderId,
      razorpayPaymentId: data.razorpayPaymentId,
      razorpaySignature: data.razorpaySignature,
    });
  } catch {
    signatureValid = false;
  }

  if (!signatureValid) {
    await createAuditLog({
      userId,
      action:   "PAYMENT_FAILED",
      entity:   "Payment",
      entityId: data.orderId,
      newValue: { reason: "INVALID_SIGNATURE", razorpayOrderId: data.razorpayOrderId },
      req,
    });
    throw new ApiError(400, PaymentErrorCode.INVALID_SIGNATURE);
  }

  // Fetched BEFORE the transaction. It is an external HTTP call that depends on
  // nothing in the database, and running it inside meant a slow Razorpay held a
  // row-locked Payment/Order transaction open — the shape that turns gateway
  // latency into connection-pool exhaustion. Every check that uses the result
  // still happens inside the transaction, under the same locks as before.
  let razorpayPayment;
  try {
    razorpayPayment = await fetchRazorpayPayment(data.razorpayPaymentId);
  } catch {
    throw new ApiError(502, "Failed to fetch payment from Razorpay");
  }

  const result = await withRetry(async () => {
    return prisma.$transaction(async (tx) => {
      const payments = await tx.$queryRaw<Array<{
        id: string; orderId: string; status: string;
        razorpayOrderId: string | null; amount: unknown;
      }>>`
        SELECT id, "orderId", status, "razorpayOrderId", amount
        FROM "Payment"
        WHERE "orderId" = ${data.orderId}
        FOR UPDATE
      `;

      const payment = payments[0];
      if (!payment) throw new ApiError(404, PaymentErrorCode.PAYMENT_NOT_FOUND);

      // Already verified. PARTIALLY_PAID counts: on a partial order the deposit capture
      // lands here and leaves the payment in that state, so recognising only SUCCESS made
      // a replayed verify fall through and fail on RAZORPAY_ORDER_ID_MISMATCH below.
      if (payment.status === "SUCCESS" || payment.status === "PARTIALLY_PAID") {
        return { success: true, orderId: data.orderId, alreadyProcessed: true, total: 0, commission: null, orphaned: false, refunded: false };
      }

      if (payment.razorpayOrderId !== data.razorpayOrderId) {
        throw new ApiError(400, PaymentErrorCode.RAZORPAY_ORDER_ID_MISMATCH);
      }

      if (razorpayPayment.order_id !== data.razorpayOrderId) {
        throw new ApiError(400, PaymentErrorCode.RAZORPAY_ORDER_ID_MISMATCH);
      }

      const expectedPaise = Math.round(Number(payment.amount) * 100);
      if (razorpayPayment.amount !== expectedPaise) {
        throw new ApiError(400, PaymentErrorCode.AMOUNT_MISMATCH);
      }

      const orders = await tx.$queryRaw<Array<{
        id: string; userId: string; status: string; affiliateId: string | null;
        total: unknown; paymentPlan: string; balanceAmount: unknown;
      }>>`
        SELECT id, "userId", status, "affiliateId", total, "paymentPlan", "balanceAmount"
        FROM "Order"
        WHERE id = ${data.orderId}
        FOR UPDATE
      `;

      const order = orders[0];
      if (!order) throw new ApiError(404, PaymentErrorCode.ORDER_NOT_FOUND);
      if (order.userId !== userId) throw new ApiError(403, PaymentErrorCode.UNAUTHORIZED_ACCESS);

      // The order was cancelled underneath us — the sweeper reclaiming an abandoned
      // checkout, or a user/admin cancel. Its stock is already back in the catalogue,
      // so confirming now would oversell. Refund instead of resurrecting the order.
      if (order.status !== "PENDING") {
        const { refunded } = await refundOrphanedCapture(tx, {
          paymentId:         payment.id,
          orderId:           data.orderId,
          razorpayPaymentId: data.razorpayPaymentId,
          amount:            Number(payment.amount),
          orderStatus:       order.status,
          gatewayResponse:   razorpayPayment,
          source:            "verify",
        });
        return { success: false, orderId: data.orderId, alreadyProcessed: false, total: 0, commission: null, orphaned: true, refunded };
      }

      // A partial order's deposit does not settle the order — the balance is still out,
      // so the payment stops at PARTIALLY_PAID. That single distinction is what keeps the
      // GST invoice, the affiliate commission and the revenue figures correct with no
      // further changes to their existing SUCCESS-only guards.
      const isPartial = order.paymentPlan === "PARTIAL";

      await tx.payment.update({
        where: { orderId: data.orderId },
        data: {
          status:            isPartial ? "PARTIALLY_PAID" : "SUCCESS",
          razorpayPaymentId: data.razorpayPaymentId,
          razorpaySignature: data.razorpaySignature,
          gatewayResponse:   razorpayPayment as any,
        },
      });

      await tx.order.update({
        where: { id: data.orderId },
        data: {
          status: "CONFIRMED",
          // Written once. Anchors the pay-before-dispatch hold, which `updatedAt` cannot
          // because any later write to the order would silently re-arm it.
          ...(isPartial ? { depositPaidAt: new Date() } : {}),
        },
      });

      // Clear the cart only now that payment is confirmed — see orders.services.ts.
      await tx.cartItem.updateMany({
        where: { userId, deletedAt: null },
        data:  { deletedAt: new Date() },
      });

      // Commission accrues on settlement, never on a deposit: an order whose balance is
      // refused at the door earns nothing, and paying out on it would mean clawing the
      // commission back later. `settleOrderIfFullyPaid` books it when the money is in.
      let commission = null;
      if (order.affiliateId && !isPartial) {
        commission = await processAffiliateCommissionService({
          tx,
          orderId:     data.orderId,
          affiliateId: order.affiliateId,
          orderTotal:  Number(order.total),
          userId,
        });
      }

      await createAuditLogInTx(tx, {
        userId,
        action:   isPartial ? "DEPOSIT_CAPTURED" : "PAYMENT_SUCCESS",
        entity:   "Payment",
        entityId: data.orderId,
        oldValue: { status: payment.status },
        newValue: {
          status: isPartial ? "PARTIALLY_PAID" : "SUCCESS",
          razorpayPaymentId: data.razorpayPaymentId,
          ...(isPartial
            ? { deposit: Number(payment.amount), balanceDue: Number(order.balanceAmount ?? 0) }
            : {}),
        },
        req,
      });

      return {
        success: true, orderId: data.orderId, alreadyProcessed: false,
        total: Number(order.total), commission, orphaned: false, refunded: false,
        isPartial, capturedAmount: Number(payment.amount),
        balanceDue: Number(order.balanceAmount ?? 0),
      };
    });
  });

  // Surfaced after the transaction commits so the refund record survives the throw.
  // ORDER_NOT_PENDING is the code both checkout stores already handle by dropping the
  // spent idempotency key, so the customer is put back on a clean, re-placeable order.
  if (result.orphaned) {
    emitOrphanedCaptureNotice(userId, result.orderId, result.refunded);
    throw new ApiError(409, PaymentErrorCode.ORDER_NOT_PENDING);
  }

  if (!result.alreadyProcessed) {
    // Report the amount actually captured, not the order value — telling a customer
    // "we received your payment of the full total" when 20% was taken is wrong.
    emitOrderConfirmed(userId, result.orderId, result.total, {
      paid: true,
      partial: result.isPartial
        ? { deposit: result.capturedAmount, balanceDue: result.balanceDue }
        : undefined,
    });
    emitCommissionEarned(result.commission, result.orderId);
  }

  return { success: result.success, orderId: result.orderId, alreadyProcessed: result.alreadyProcessed };
}

/**
 * Cash on Delivery was withdrawn — `createCodPaymentService` is gone and
 * `POST /payments/cod` now answers 410. Everything downstream of a COD order that
 * already exists is deliberately untouched: settleCodOnDelivery(), the COD branches
 * in refunds and admin cancellation, and the Delhivery "COD" paymentMode all still
 * run for parcels that are already in the field.
 */
export async function handleRazorpayWebhookService(
  rawBody:   Buffer,
  signature: string,
  payload:   any
): Promise<{ processed: boolean; message: string }> {
  const eventId   = payload?.id ?? payload?.payload?.payment?.entity?.id ?? "unknown";
  const eventType = payload?.event ?? "unknown";
  const provider  = "razorpay";

  let webhookEvent;
  try {
    webhookEvent = await prisma.webhookEvent.create({
      data: {
        provider,
        eventId,
        eventType,
        payload: payload as any,
        status:  "PROCESSING",
      },
    });
  } catch (err: any) {
    if (err?.code === "P2002" || err?.message?.includes("Unique constraint")) {
      const existing = await prisma.webhookEvent.findUnique({
        where: { provider_eventId: { provider, eventId } },
      });
      if (existing?.status === "PROCESSED" || existing?.status === "SKIPPED") {
        return { processed: false, message: "Duplicate webhook — already processed" };
      }

      // A previous attempt failed. Now that the controller returns a non-2xx on
      // failure, Razorpay retries — and that retry is the only chance this event
      // gets. Without reclaiming the FAILED row it would be dismissed as a duplicate
      // and the payment would never be applied. Claimed atomically so two retries
      // cannot both reprocess it.
      if (existing?.status === "FAILED") {
        const claimed = await prisma.webhookEvent.updateMany({
          where: { id: existing.id, status: "FAILED" },
          data:  { status: "PROCESSING", error: null },
        });
        if (claimed.count === 0) {
          return { processed: false, message: "Duplicate webhook — in progress" };
        }
        webhookEvent = existing;
      } else {
        return { processed: false, message: "Duplicate webhook — in progress" };
      }
    } else {
      throw err;
    }
  }

  try {
    switch (eventType) {
      case "payment.captured":
        await handlePaymentCaptured(payload);
        break;
      case "payment.failed":
        await handlePaymentFailed(payload);
        break;
      case "refund.created":
      case "refund.processed":
        await handleRefundProcessed(payload);
        break;
      case "refund.failed":
        await handleRefundFailed(payload);
        break;
      default:
        await prisma.webhookEvent.update({
          where: { id: webhookEvent.id },
          data:  { status: "SKIPPED", processedAt: new Date() },
        });
        return { processed: false, message: `Event ${eventType} not handled` };
    }

    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data:  { status: "PROCESSED", processedAt: new Date() },
    });

    return { processed: true, message: "Webhook processed" };
  } catch (err: any) {
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: {
        status: "FAILED",
        error:  err?.message?.substring(0, 500) ?? "Unknown error",
      },
    }).catch(() => {}); // Don't throw on audit update failure

    throw err;
  }
}

async function handlePaymentCaptured(payload: any): Promise<void> {
  const entity         = payload?.payload?.payment?.entity;
  const razorpayOrderId = entity?.order_id;
  const razorpayPaymentId = entity?.id;
  const amountPaise    = entity?.amount;

  if (!razorpayOrderId || !razorpayPaymentId) return;

  let foundPayment = true;
  const confirmed = await withRetry(async () => {
    return prisma.$transaction(async (tx) => {
      const payments = await tx.$queryRaw<Array<{
        id: string; orderId: string; status: string; amount: unknown;
      }>>`
        SELECT id, "orderId", status, amount
        FROM "Payment"
        WHERE "razorpayOrderId" = ${razorpayOrderId}
        FOR UPDATE
      `;

      const payment = payments[0];
      if (!payment) { foundPayment = false; return null; } // not a normal order payment — maybe a pre-order leg

      // PARTIALLY_PAID means this deposit was already booked by the verify call.
      if (payment.status === "SUCCESS" || payment.status === "PARTIALLY_PAID") return null;

      const expectedPaise = Math.round(Number(payment.amount) * 100);
      if (amountPaise && amountPaise !== expectedPaise) {
        throw new ApiError(400, PaymentErrorCode.AMOUNT_MISMATCH);
      }

      // Lock the order and re-check it is still PENDING before confirming. The
      // sweeper may have reclaimed it as an abandoned checkout and already returned
      // its stock; resurrecting it here would oversell. Same guard as verify.
      const lockedOrders = await tx.$queryRaw<Array<{ status: string; userId: string }>>`
        SELECT status, "userId"
        FROM "Order"
        WHERE id = ${payment.orderId}
        FOR UPDATE
      `;
      const lockedOrder = lockedOrders[0];

      if (lockedOrder && lockedOrder.status !== "PENDING") {
        const { refunded } = await refundOrphanedCapture(tx, {
          paymentId:         payment.id,
          orderId:           payment.orderId,
          razorpayPaymentId,
          amount:            Number(payment.amount),
          orderStatus:       lockedOrder.status,
          gatewayResponse:   entity,
          source:            "webhook",
        });
        return {
          orphaned: true as const,
          refunded,
          userId:   lockedOrder.userId,
          orderId:  payment.orderId,
          total:    0,
          commission: null,
        };
      }

      // Mirrors verify: a deposit stops at PARTIALLY_PAID, and only a settled balance
      // takes the payment to SUCCESS.
      const planRow = await tx.order.findUnique({
        where:  { id: payment.orderId },
        select: { paymentPlan: true, balanceAmount: true },
      });
      const isPartial = planRow?.paymentPlan === "PARTIAL";

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status:            isPartial ? "PARTIALLY_PAID" : "SUCCESS",
          razorpayPaymentId,
          gatewayResponse:   entity as any,
        },
      });

      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          status: "CONFIRMED",
          ...(isPartial ? { depositPaidAt: new Date() } : {}),
        },
      });

      const order = await tx.order.findUnique({
        where:  { id: payment.orderId },
        select: { affiliateId: true, total: true, userId: true, createdAt: true },
      });

      if (order) {
        // Clear the cart only now that payment is confirmed — see orders.services.ts.
        // This path can fire minutes later, so only clear what was in the cart when
        // the order was placed; anything added since must survive. `updatedAt` is the
        // right column because the @@unique([userId, productId, variantId]) constraint
        // means re-adding a soft-deleted item revives the same row.
        await tx.cartItem.updateMany({
          where: { userId: order.userId, deletedAt: null, updatedAt: { lte: order.createdAt } },
          data:  { deletedAt: new Date() },
        });
      }

      // Commission accrues on settlement, not on a deposit — see verifyPaymentService.
      let commission = null;
      if (order?.affiliateId && !isPartial) {
        commission = await processAffiliateCommissionService({
          tx,
          orderId:     payment.orderId,
          affiliateId: order.affiliateId,
          orderTotal:  Number(order.total),
          userId:      order.userId,
        });
      }

      await createAuditLogInTx(tx, {
        action:   isPartial ? "DEPOSIT_CAPTURED" : "PAYMENT_SUCCESS",
        entity:   "Payment",
        entityId: payment.orderId,
        oldValue: { status: payment.status },
        newValue: {
          status: isPartial ? "PARTIALLY_PAID" : "SUCCESS",
          source: "webhook",
          razorpayPaymentId,
        },
      });

      return order
        ? {
            orphaned: false as const, refunded: false, userId: order.userId,
            orderId: payment.orderId, total: Number(order.total), commission,
            isPartial, capturedAmount: Number(payment.amount),
            balanceDue: Number(planRow?.balanceAmount ?? 0),
          }
        : null;
    });
  });

  if (confirmed?.orphaned) {
    emitOrphanedCaptureNotice(confirmed.userId, confirmed.orderId, confirmed.refunded);
  } else if (confirmed) {
    emitOrderConfirmed(confirmed.userId, confirmed.orderId, confirmed.total, {
      paid: true,
      partial: confirmed.isPartial
        ? { deposit: confirmed.capturedAmount, balanceDue: confirmed.balanceDue }
        : undefined,
    });
    emitCommissionEarned(confirmed.commission, confirmed.orderId);
  }

  // Backup reconciliation for pre-order booking/balance legs (not in the Payment table).
  if (!foundPayment) {
    await reconcilePreOrderByRazorpayOrderId(razorpayOrderId, razorpayPaymentId, entity).catch((err) =>
      console.error("[webhook] pre-order reconcile failed:", err)
    );
  }
}

async function handlePaymentFailed(payload: any): Promise<void> {
  const entity          = payload?.payload?.payment?.entity;
  const razorpayOrderId = entity?.order_id;

  if (!razorpayOrderId) return;

  const failed = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { razorpayOrderId },
      include: { order: { select: { userId: true } } },
    });
    if (!payment || payment.status === "SUCCESS") return null;

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status:          "FAILED",
        gatewayResponse: entity as any,
      },
    });

    // An explicitly declined payment is the clearest possible signal that this order
    // will never be paid — there is nothing to wait for. Hand its stock back now
    // instead of letting it sit until the sweeper's TTL expires.
    const released = await releasePendingOrderStock(tx, payment.orderId);

    await createAuditLogInTx(tx, {
      action:   "PAYMENT_FAILED",
      entity:   "Payment",
      entityId: payment.orderId,
      newValue: {
        status:       "FAILED",
        source:       "webhook",
        orderCancelled: released,
        errorCode:    entity?.error_code,
        errorDesc:    entity?.error_description,
      },
    });

    return { userId: payment.order.userId, orderId: payment.orderId, released };
  });

  if (failed) {
    void notify({
      userId: failed.userId,
      type: "PAYMENT_FAILED",
      title: "Payment failed",
      body: failed.released
        ? `We couldn't process the payment for order #${orderShortRef(failed.orderId)}, so it has been cancelled. Your items are still in your cart — please try again.`
        : `We couldn't process the payment for order #${orderShortRef(failed.orderId)}. Please try again.`,
      data: { screen: "Order", orderId: failed.orderId },
    });
  }
}

/**
 * The captured/refunded state of one payment, leg by leg.
 *
 * A Payment can carry two separate Razorpay captures: the primary leg (`amount`, a full
 * payment or a partial order's deposit) and the balance leg (`balanceAmount`). Whether the
 * *order* is fully refunded is a question about both, so it cannot be answered by comparing
 * a single refund against a single `amount` — which is exactly what this used to do.
 */
type PaymentLegs = {
  amount: unknown; balanceAmount: unknown;
  razorpayPaymentId: string | null; balanceRazorpayPaymentId: string | null;
  refundAmount: unknown; balanceRefundAmount: unknown;
};

/**
 * True when every leg that actually took money has been refunded in full.
 *
 * Only that state may mark the payment REFUNDED and unwind the order. On a FULL order
 * (no balance leg) this reduces exactly to the previous single-leg comparison.
 */
function allCapturedLegsRefunded(p: PaymentLegs): boolean {
  const legs: Array<{ captured: number; refunded: number }> = [];
  if (p.razorpayPaymentId) {
    legs.push({ captured: Number(p.amount), refunded: Number(p.refundAmount ?? 0) });
  }
  if (p.balanceRazorpayPaymentId) {
    legs.push({
      captured: Number(p.balanceAmount ?? 0),
      refunded: Number(p.balanceRefundAmount ?? 0),
    });
  }
  if (legs.length === 0) return false;
  // The 0.01 slack matches the existing tolerance for gateway rounding.
  return legs.every((l) => l.refunded >= l.captured - 0.01);
}

async function handleRefundProcessed(payload: any): Promise<void> {
  const refundEntity    = payload?.payload?.refund?.entity;
  const razorpayRefundId = refundEntity?.id;
  const paymentId       = refundEntity?.payment_id;
  const amountPaise     = refundEntity?.amount;

  if (!paymentId) return;

  const refunded = await prisma.$transaction(async (tx) => {
    // Match on BOTH capture ids and let the matching column name the leg. A balance-leg
    // refund carries its own payment id, so keying on `razorpayPaymentId` alone found no
    // row and the refund vanished silently.
    const payments = await tx.$queryRaw<Array<{
      id: string; orderId: string; status: string;
      amount: unknown; balanceAmount: unknown;
      razorpayPaymentId: string | null; balanceRazorpayPaymentId: string | null;
      refundId: string | null; balanceRefundId: string | null;
      refundAmount: unknown; balanceRefundAmount: unknown;
      refundedAt: Date | null; balanceRefundedAt: Date | null;
      leg: "primary" | "balance";
    }>>`
      SELECT id, "orderId", status, amount, "balanceAmount",
             "razorpayPaymentId", "balanceRazorpayPaymentId",
             "refundId", "balanceRefundId",
             "refundAmount", "balanceRefundAmount",
             "refundedAt", "balanceRefundedAt",
             CASE WHEN "razorpayPaymentId" = ${paymentId} THEN 'primary' ELSE 'balance' END AS leg
      FROM "Payment"
      WHERE "razorpayPaymentId" = ${paymentId}
         OR "balanceRazorpayPaymentId" = ${paymentId}
      FOR UPDATE
    `;

    const payment = payments[0];
    if (!payment) return null;

    // Idempotent on the leg's SETTLED timestamp, which only this handler writes.
    //
    // Not on the refund id: every refund we place ourselves records its id at the moment
    // the gateway accepts it, so matching on the id would treat the very first webhook as
    // a replay and drop it — leaving the payment at REFUND_INITIATED forever, the order
    // never REFUNDED, and the customer never told. Not on the payment status either: with
    // two legs the payment sits at PARTIALLY_REFUNDED between them, which is a legitimate
    // state for the second leg to arrive in.
    const legSettledAt =
      payment.leg === "primary" ? payment.refundedAt : payment.balanceRefundedAt;
    if (legSettledAt) return null;

    const capturedOnLeg =
      payment.leg === "primary" ? Number(payment.amount) : Number(payment.balanceAmount ?? 0);
    const refundAmount = amountPaise ? amountPaise / 100 : undefined;

    // A partial refund must not mark the whole payment (and the whole order) refunded.
    // `resolveReturnService` can refund less than the captured amount, and this once
    // flipped a ₹2000 order to REFUNDED over a ₹100 return. The comparison is now against
    // the amount captured on THIS leg.
    const legFullyRefunded = refundAmount === undefined || refundAmount >= capturedOnLeg - 0.01;
    // Write the leg's captured amount when the event carries none, rather than leaving a
    // stale value behind (Prisma treats `undefined` as "don't update").
    const recordedAmount = new Decimal(refundAmount ?? capturedOnLeg);

    const legData =
      payment.leg === "primary"
        ? { refundId: razorpayRefundId, refundAmount: recordedAmount, refundedAt: new Date() }
        : {
            balanceRefundId: razorpayRefundId,
            balanceRefundAmount: recordedAmount,
            balanceRefundedAt: new Date(),
          };

    // Decide the overall status from the post-update picture of both legs.
    const after: PaymentLegs = {
      amount: payment.amount,
      balanceAmount: payment.balanceAmount,
      razorpayPaymentId: payment.razorpayPaymentId,
      balanceRazorpayPaymentId: payment.balanceRazorpayPaymentId,
      refundAmount:
        payment.leg === "primary" && legFullyRefunded ? recordedAmount : payment.refundAmount,
      balanceRefundAmount:
        payment.leg === "balance" && legFullyRefunded
          ? recordedAmount
          : payment.balanceRefundAmount,
    };
    const isFullRefund = allCapturedLegsRefunded(after);

    await tx.payment.update({
      where: { id: payment.id },
      data: { status: isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED", ...legData },
    });

    // Only a fully-refunded order unwinds. A partially refunded one keeps the status its
    // return/cancellation flow gave it.
    const order = isFullRefund
      ? await tx.order.update({
          where: { id: payment.orderId },
          data:  { status: "REFUNDED" },
          select: { userId: true },
        })
      : await tx.order.findUniqueOrThrow({
          where: { id: payment.orderId },
          select: { userId: true },
        });

    await createAuditLogInTx(tx, {
      action:   "REFUND_SUCCESS",
      entity:   "Payment",
      entityId: payment.orderId,
      newValue: {
        refundId: razorpayRefundId, refundAmount, leg: payment.leg,
        partial: !isFullRefund, source: "webhook",
      },
    });

    return { userId: order.userId, orderId: payment.orderId, refundAmount };
  });

  if (refunded) {
    void notify({
      userId: refunded.userId,
      type: "REFUND_PROCESSED",
      title: "Refund processed 💸",
      body: refunded.refundAmount
        ? `Your refund of ${money(refunded.refundAmount)} for order #${orderShortRef(refunded.orderId)} has been processed.`
        : `Your refund for order #${orderShortRef(refunded.orderId)} has been processed.`,
      data: { screen: "Order", orderId: refunded.orderId },
    });
  }
}

/**
 * Razorpay could not complete a refund we had already initiated.
 *
 * This event was falling through to `default:` and being marked SKIPPED, so a
 * refund that failed at the gateway left the payment sitting at REFUND_INITIATED
 * forever — the customer had been told "refund on its way", and nobody was told it
 * hadn't arrived.
 *
 * The status is deliberately left at REFUND_INITIATED rather than reset to SUCCESS:
 * Razorpay refunds are not idempotent, and a `refund.failed` we've misread would
 * let a retry pay the customer twice. A human reconciles from the audit row, which
 * is the same policy `refundOrderMoney` follows for a failed API call.
 */
async function handleRefundFailed(payload: any): Promise<void> {
  const refundEntity     = payload?.payload?.refund?.entity;
  const razorpayRefundId = refundEntity?.id;
  const paymentId        = refundEntity?.payment_id;
  const amountPaise      = refundEntity?.amount;

  if (!paymentId) return;

  // Same OR-lookup as handleRefundProcessed: a failed refund on the balance leg carries
  // the balance capture's payment id, which `razorpayPaymentId` alone never matches.
  const payment = await prisma.payment.findFirst({
    where: {
      OR: [
        { razorpayPaymentId: paymentId },
        { balanceRazorpayPaymentId: paymentId },
      ],
    },
    select: {
      id: true, orderId: true, status: true,
      razorpayPaymentId: true, balanceRazorpayPaymentId: true,
      refundedAt: true, balanceRefundedAt: true,
    },
  });

  if (!payment) return;

  const leg = payment.razorpayPaymentId === paymentId ? "primary" : "balance";

  // Already settled — a late failure event for a refund that went through. Checked per
  // leg, not on the payment status: PARTIALLY_REFUNDED is the normal state of a two-leg
  // order once its first leg settles, so a status check discarded every balance-leg
  // failure with no audit row and no alert.
  const legSettledAt = leg === "primary" ? payment.refundedAt : payment.balanceRefundedAt;
  if (legSettledAt) return;

  const amount = amountPaise ? amountPaise / 100 : undefined;

  // Record the failed refund id on its own leg so a human reconciling in Razorpay can
  // tell which capture the failure belongs to. The status is deliberately left at
  // REFUND_INITIATED (see the doc comment above).
  await prisma.payment.update({
    where: { id: payment.id },
    data:
      leg === "primary"
        ? { refundId: razorpayRefundId ?? undefined }
        : { balanceRefundId: razorpayRefundId ?? undefined },
  });

  await createAuditLog({
    action:   "REFUND_FAILED",
    entity:   "Payment",
    entityId: payment.orderId,
    newValue: {
      refundId: razorpayRefundId,
      amount,
      leg,
      reason: refundEntity?.error_description ?? refundEntity?.status ?? "unknown",
      source: "webhook",
    },
  });

  void notifyAdmins({
    type:  "ADMIN_CUSTOM",
    title: "Refund failed at Razorpay ⚠️",
    body: `The refund${amount ? ` of ${money(amount)}` : ""} for order #${orderShortRef(
      payment.orderId
    )} failed at the gateway. Reconcile it manually in Razorpay.`,
    data: { screen: "AdminOrder", orderId: payment.orderId },
  });
}

export async function createReturnRequestService(
  userId:  string,
  orderId: string,
  data:    CreateReturnBody,
  req?:    Request
) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, userId, deletedAt: null },
      include: {
        payment: true,
        returns: true,
        shipments: {
          where: { deliveredAt: { not: null } },
          orderBy: { deliveredAt: "desc" },
          take: 1,
          select: { deliveredAt: true },
        },
      },
    });

    if (!order) throw new ApiError(404, PaymentErrorCode.ORDER_NOT_FOUND);
    if (order.userId !== userId) throw new ApiError(403, PaymentErrorCode.UNAUTHORIZED_ACCESS);

    if (order.status !== "DELIVERED") {
      throw new ApiError(400, PaymentErrorCode.RETURN_NOT_ELIGIBLE);
    }

    if (order.returns.length > 0) {
      throw new ApiError(409, PaymentErrorCode.RETURN_ALREADY_REQUESTED);
    }

    // The courier's delivery timestamp, not `order.updatedAt` — that bumps on ANY
    // write, so any admin touch silently restarted the customer's return window.
    // Falls back to updatedAt only for orders marked delivered by hand, which have
    // no shipment timestamp to read.
    const deliveredAt = order.shipments[0]?.deliveredAt ?? order.updatedAt;
    const returnWindowEnd = new Date(deliveredAt);
    returnWindowEnd.setDate(returnWindowEnd.getDate() + RETURN_WINDOW_DAYS);
    if (new Date() > returnWindowEnd) {
      throw new ApiError(400, PaymentErrorCode.RETURN_NOT_ELIGIBLE);
    }

    const returnRequest = await tx.return.create({
      data: {
        orderId,
        userId,
        reason:      data.reason,
        description: data.description,
        status:      "PENDING",
      },
    });

    await tx.order.update({
      where: { id: orderId },
      data:  { status: "RETURN_REQUESTED" },
    });

    await createAuditLogInTx(tx, {
      userId,
      action:   "RETURN_REQUESTED",
      entity:   "Return",
      entityId: returnRequest.id,
      newValue: { orderId, reason: data.reason },
      req,
    });

    return {
      returnId: returnRequest.id,
      orderId,
      status:   returnRequest.status,
      message:  "Return request submitted. Our team will review within 2-3 business days.",
    };
  });
}

export async function resolveReturnService(
  adminUserId: string,
  returnId:    string,
  data:        ResolveReturnBody,
  req?:        Request
) {
  const result = await withRetry(async () => {
    return prisma.$transaction(async (tx) => {
      // Filled inside the transaction, actioned after it commits. Returned rather
      // than captured in a closure so a retried attempt cannot leak its intent.
      let pendingRefund: { amount: number; full: boolean } | null = null;
      const returns = await tx.$queryRaw<Array<{
        id: string; orderId: string; status: string; userId: string;
      }>>`
        SELECT id, "orderId", status, "userId"
        FROM "Return"
        WHERE id = ${returnId}
        FOR UPDATE
      `;

      const returnReq = returns[0];
      if (!returnReq) throw new ApiError(404, PaymentErrorCode.RETURN_NOT_FOUND);
      if (returnReq.status !== "PENDING") {
        throw new ApiError(409, PaymentErrorCode.RETURN_ALREADY_RESOLVED);
      }

      const order = await tx.order.findUnique({
        where:   { id: returnReq.orderId },
        include: { payment: true, commissions: true },
      });
      if (!order) throw new ApiError(404, PaymentErrorCode.ORDER_NOT_FOUND);

      const newReturnStatus = data.status === "APPROVED" ? "APPROVED" : "REJECTED";
      await tx.return.update({
        where: { id: returnId },
        data: {
          status:     newReturnStatus,
          adminNote:  data.adminNote,
          resolvedBy: adminUserId,
          resolvedAt: new Date(),
        },
      });

      const newOrderStatus = data.status === "APPROVED"
        ? "RETURN_APPROVED"
        : "RETURN_REJECTED";

      await tx.order.update({
        where: { id: returnReq.orderId },
        data:  { status: newOrderStatus },
      });

      // Approved returns put the units back on sale. Gated on the return's own
      // PENDING -> APPROVED claim above (`RETURN_ALREADY_RESOLVED`), so approving
      // twice cannot restore twice. The RTO path deliberately skips RETURN_* orders
      // so the parcel physically arriving does not restore them a second time.
      if (data.status === "APPROVED") {
        await restoreOrderStock(tx, returnReq.orderId);
      }

      if (data.status === "APPROVED" && order.payment) {
        const payment = order.payment;

        if (payment.status === "REFUNDED") {
          throw new ApiError(409, PaymentErrorCode.REFUND_ALREADY_ISSUED);
        }
        if (payment.method === "COD") {
          await tx.payment.update({
            where: { orderId: returnReq.orderId },
            data: {
              status:       "REFUND_INITIATED",
              refundReason: data.adminNote ?? "Return approved",
            },
          });
        } else if (payment.method === "ONLINE" && payment.razorpayPaymentId) {
          // The gateway call is deliberately NOT made here — it runs after the
          // commit (see below), so Razorpay latency never holds this transaction's
          // row locks open. The intent is recorded now; the refund id lands after.
          //
          // The default is everything the customer actually PAID, not `payment.amount`.
          // On a partial order (and on a converted pre-order) that column holds only the
          // first leg, so defaulting to it refunded ~20% of an approved return and
          // silently kept the rest.
          const received =
            Number(payment.amount) +
            (payment.balanceSettledAt ? Number(payment.balanceAmount ?? 0) : 0);
          const refundAmount = data.refundAmount ?? received;

          await tx.payment.update({
            where: { orderId: returnReq.orderId },
            data: {
              status:       "REFUND_INITIATED",
              refundReason: data.adminNote ?? "Return approved",
            },
          });

          await tx.return.update({
            where: { id: returnId },
            data: {
              refundAmount: new Decimal(refundAmount),
            },
          });

          pendingRefund = { amount: refundAmount, full: refundAmount >= received - 0.01 };
        }

        await reverseAffiliateCommissionsService({ tx, orderId: returnReq.orderId, adminUserId });
      }

      await createAuditLogInTx(tx, {
        userId: adminUserId,
        action:   data.status === "APPROVED" ? "RETURN_APPROVED" : "RETURN_REJECTED",
        entity:   "Return",
        entityId: returnId,
        oldValue: { status: "PENDING" },
        newValue: { status: newReturnStatus, adminNote: data.adminNote },
        req,
      });

      return {
        returnId,
        status:    newReturnStatus,
        orderId:   returnReq.orderId,
        refundInitiated: data.status === "APPROVED" && order.payment?.method === "ONLINE",
        pendingRefund,
      };
    });
  });

  const { pendingRefund, ...response } = result;

  // Gateway call after the commit. Never throws: the return is already approved and
  // the stock already back, so a gateway outage must not fail the whole operation —
  // it raises a human instead, exactly as the cancellation refund path does.
  if (pendingRefund) {
    // Delegated rather than calling the gateway directly, so an approved return returns
    // EVERY captured leg — and a balance that arrived as cash, which no gateway can
    // reverse, lands in the manual-payout queue instead of vanishing. `alreadyClaimed`
    // because the transaction above moved the payment to REFUND_INITIATED atomically
    // with the approval; re-claiming here would lose to our own write and refund nothing.
    await refundOrderMoney(result.orderId, data.adminNote ?? "Return approved", {
      scope: "ALL",
      limit: pendingRefund.full ? undefined : pendingRefund.amount,
      alreadyClaimed: true,
    });
  }

  return response;
}

export async function trackOrderService(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId, deletedAt: null },
    include: {
      shipments: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!order) throw new ApiError(404, PaymentErrorCode.ORDER_NOT_FOUND);

  const shipment = order.shipments[0];

  if (!shipment) {
    return {
      orderId,
      status:     order.status,
      awbCode:    null,
      trackingUrl: null,
      courierName: null,
      trackingData: null,
      message:    "Order is being processed. Tracking will be available once shipped.",
    };
  }

  let trackingData   = shipment.trackingData;
  let shipmentStatus = shipment.status;
  let deliveredAt    = shipment.deliveredAt;

  if (shipment.awbCode) {
    try {
      const tracking = await trackByWaybill(shipment.awbCode);
      trackingData   = tracking.raw as any;
      shipmentStatus = mapDelhiveryStatus(tracking.status, tracking.statusType);
      deliveredAt    =
        shipmentStatus === "DELIVERED"
          ? (tracking.deliveredDate ? new Date(tracking.deliveredDate) : shipment.deliveredAt ?? new Date())
          : shipment.deliveredAt;

      await prisma.shipment.update({
        where: { id: shipment.id },
        data:  { trackingData: tracking.raw as any, status: shipmentStatus, deliveredAt },
      });
    } catch {
      // Use cached data if the Delhivery call fails
    }
  }

  return {
    orderId,
    status:       order.status,
    awbCode:      shipment.awbCode,
    trackingUrl:  shipment.trackingUrl,
    courierName:  shipment.courierName,
    trackingData,
    shipmentStatus,
    estimatedAt:  shipment.estimatedAt,
    deliveredAt,
  };
}

/**
 * The order stopped being shippable while we were talking to Delhivery. Carries the
 * waybill so the caller can pull it back — the parcel is already booked at this point.
 */
class OrderNoLongerShippableError extends Error {
  constructor(public readonly waybill: string) {
    super("Order is no longer in a shippable state");
  }
}

/**
 * Undo a dispatch latch that was claimed for a shipment which then failed to book.
 *
 * The latch is deliberately taken before the Delhivery call, because deciding the
 * collection mode and closing the online balance link have to be one atomic act. That
 * makes it a claim over an external call that can fail, so every failure path has to give
 * it back — otherwise a transient courier error permanently commits an unshipped order to
 * cash-on-delivery and kills its payment link.
 *
 * Never throws: it runs inside error handling, and the caller's original failure is the
 * one worth reporting.
 */
async function releaseDispatchLatch(orderId: string, wasClaimed: boolean): Promise<void> {
  if (!wasClaimed) return;
  try {
    await prisma.order.updateMany({
      where: { id: orderId, dispatchLockedAt: { not: null } },
      data:  { dispatchLockedAt: null },
    });
    await prisma.payment.updateMany({
      where: { orderId, balanceSettledAt: null, balanceMethod: "COD" },
      data:  { balanceMethod: null },
    });
  } catch (err) {
    console.error(`[shipment] could not release dispatch latch for order ${orderId}:`, err);
  }
}

export async function createShipmentService(
  adminUserId: string,
  orderId:     string,
  req?:        Request
) {
  const order = await prisma.order.findUnique({
    where:   { id: orderId, deletedAt: null },
    include: {
      address:    true,
      items:      { include: { product: { select: { name: true } } } },
      payment:    true,
      shipments:  true,
    },
  });

  if (!order) throw new ApiError(404, PaymentErrorCode.ORDER_NOT_FOUND);

  if (!["CONFIRMED", "PROCESSING"].includes(order.status)) {
    throw new ApiError(400, "Order is not in a shippable state");
  }

  // Ignore prior FAILED (e.g. cancelled) shipments so a re-ship is possible.
  const activeShipment = order.shipments.find(
    (s) => s.providerRefId && s.status !== "FAILED"
  );
  if (activeShipment) {
    throw new ApiError(409, "Shipment already created for this order");
  }

  const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const productsDesc =
    order.items.map((item) => item.product.name).join(", ").substring(0, 200) || "Order items";

  // ── Decide the collection mode, and commit to it, BEFORE talking to Delhivery ──
  //
  // The manifest mode and the death of the online balance link are one decision, so they
  // are made together and latched. `dispatchLockedAt` is the record that a COD parcel is
  // committed for this amount: from here a late online balance capture must be refunded
  // rather than applied, because the courier will still ask for cash at the door.
  //
  // Claimed atomically so two concurrent ship attempts (admin button racing the sweeper)
  // cannot both decide it.
  const balanceOutstanding =
    order.paymentPlan === "PARTIAL" && !order.payment?.balanceSettledAt;

  if (balanceOutstanding) {
    await prisma.order.updateMany({
      where: { id: orderId, dispatchLockedAt: null },
      data:  { dispatchLockedAt: new Date(), balanceToken: null },
    });
    await prisma.payment.updateMany({
      where: { orderId, balanceMethod: null },
      data:  { balanceMethod: "COD" },
    });
    await createAuditLog({
      action:   "BALANCE_LINK_CLOSED_AT_DISPATCH",
      entity:   "Order",
      entityId: orderId,
      newValue: { codAmount: Number(order.balanceAmount ?? 0) },
    });
  }

  // A partial order collects only its BALANCE at the door — never `order.total`, which
  // would re-collect the deposit the customer already paid online.
  const shipsCod = balanceOutstanding || order.paymentMethod === "COD";
  const codAmount = balanceOutstanding
    ? Number(order.balanceAmount ?? 0)
    : order.paymentMethod === "COD"
      ? Number(order.total)
      : 0;

  let delhiveryResponse;
  try {
    delhiveryResponse = await createDelhiveryShipment({
      order:       order.id,
      name:        order.address.name,
      add:         order.address.address,
      city:        order.address.city,
      state:       order.address.state,
      country:     order.address.country,
      pin:         order.address.pincode,
      phone:       order.address.phone,
      paymentMode: shipsCod ? "COD" : "Prepaid",
      codAmount,
      totalAmount: Number(order.total),
      productsDesc,
      quantity:    totalQuantity,
    });
  } catch (err: any) {
    // The parcel was never booked, so the collection decision must not stand. Leaving the
    // latch set would keep the balance permanently addressed to a courier that never got
    // the shipment, and would close the online link for an order that has not shipped.
    await releaseDispatchLatch(orderId, balanceOutstanding);

    if (err instanceof ApiError) throw err;
    // Network/DNS/timeout — not a Delhivery rejection. Keep the cause visible
    // instead of reporting it as an order failure.
    console.error(`[shipment] Delhivery call threw for order ${orderId}:`, err);
    throw new ApiError(502, `${PaymentErrorCode.DELHIVERY_ORDER_FAILED}: ${err?.message ?? "network error"}`);
  }

  const trackingUrl = `https://www.delhivery.com/track/package/${delhiveryResponse.waybill}`;

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.create({
      data: {
        orderId,
        providerRefId:      delhiveryResponse.refnum,
        providerShipmentId: delhiveryResponse.waybill,
        awbCode:            delhiveryResponse.waybill,
        courierName:        "Delhivery",
        trackingUrl,
        status:             "PROCESSING",
        trackingData:       delhiveryResponse.raw as any,
      },
    });

    // Re-assert the order is STILL shippable. The status was read before the
    // Delhivery round-trip, which is slow enough for a cancellation to land in
    // between — and a blind update would resurrect a cancelled, already-refunded
    // order into PROCESSING with a live waybill against it.
    const claimed = await tx.order.updateMany({
      where: {
        id:     orderId,
        status: { in: ["CONFIRMED", "PROCESSING"] },
      },
      data: {
        status:             "PROCESSING",
        providerRefId:      delhiveryResponse.refnum,
        providerShipmentId: delhiveryResponse.waybill,
        awbCode:            delhiveryResponse.waybill,
        trackingUrl,
      },
    });

    if (claimed.count === 0) {
      // Rolls the Shipment row back with the transaction; the waybill booked with
      // Delhivery is cancelled by the caller below.
      throw new OrderNoLongerShippableError(delhiveryResponse.waybill);
    }

    await createAuditLogInTx(tx, {
      userId: adminUserId,
      action:   "SHIPMENT_CREATED",
      entity:   "Shipment",
      entityId: shipment.id,
      newValue: {
        waybill: delhiveryResponse.waybill,
        refnum:  delhiveryResponse.refnum,
      },
      req,
    });

    return {
      shipmentId:  shipment.id,
      waybill:     delhiveryResponse.waybill,
      awbCode:     delhiveryResponse.waybill,
      courierName: "Delhivery",
      trackingUrl,
    };
    });
  } catch (err) {
    if (err instanceof OrderNoLongerShippableError) {
      // The DB rolled back, but Delhivery is still holding a booked waybill for an
      // order nobody intends to ship. Pull it back; if the courier refuses, a human
      // has to, so make sure one is told.
      try {
        await cancelDelhiveryShipment(err.waybill);
      } catch (cancelErr: any) {
        console.error(`[shipment] orphaned waybill ${err.waybill} for order ${orderId}:`, cancelErr?.message ?? cancelErr);
        void notifyAdmins({
          type:  "ADMIN_CUSTOM",
          title: "Waybill booked for a cancelled order ⚠️",
          body: `Order #${orderShortRef(orderId)} changed status while it was being manifested. Delhivery waybill ${err.waybill} could not be cancelled automatically — cancel it manually before the parcel ships.`,
          data:  { screen: "AdminOrder", orderId },
        });
      }
      await releaseDispatchLatch(orderId, balanceOutstanding);
      throw new ApiError(409, "Order is no longer in a shippable state");
    }
    await releaseDispatchLatch(orderId, balanceOutstanding);
    throw err;
  }

  void notify({
    userId: order.userId,
    type: "ORDER_PROCESSING",
    title: "Order is being packed 📦",
    body: `Your order #${orderShortRef(orderId)} has been handed to Delhivery. You can track it now.`,
    data: { screen: "Order", orderId, trackingUrl },
  });

  // A partial order's tax invoice is raised HERE rather than on settlement, because the
  // invoice must travel with the goods (CGST §31(1)) and its balance is not collected
  // until delivery. Fail-soft: the parcel is already manifested, and the invoice is
  // recoverable from the download endpoint.
  if (balanceOutstanding) {
    void issueInvoiceForOrder(orderId).catch((err) =>
      console.error(`[invoice] dispatch-time issue failed for order ${orderId}:`, err)
    );

    void notify({
      userId: order.userId,
      type: "PAYMENT_SUCCESS",
      title: "Balance due on delivery 💵",
      body: `Your order #${orderShortRef(orderId)} has shipped. Please keep ${money(
        Number(order.balanceAmount ?? 0)
      )} ready — the delivery agent will collect it at your door.`,
      data: { screen: "Order", orderId },
    });
  }

  return result;
}

export async function cancelShipmentService(
  adminUserId: string,
  orderId:     string,
  req?:        Request,
  /**
   * Whether to put the order back into a shippable state.
   *
   * True for the standalone "Cancel Shipment" action, whose whole purpose is to
   * free the order up for a re-ship. **False when the caller has just cancelled the
   * order**: reverting to CONFIRMED there silently un-cancelled an order that had
   * already been refunded, and left it matching the auto-ship sweeper's query
   * (CONFIRMED + no non-FAILED shipment), which then booked a fresh waybill and
   * shipped goods the customer had been refunded for.
   */
  opts: { revertOrderStatus?: boolean } = {}
) {
  const { revertOrderStatus = true } = opts;
  const order = await prisma.order.findUnique({
    where:   { id: orderId, deletedAt: null },
    include: { shipments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  if (!order) throw new ApiError(404, PaymentErrorCode.ORDER_NOT_FOUND);

  const shipment = order.shipments[0];
  if (!shipment || !shipment.awbCode) {
    throw new ApiError(404, PaymentErrorCode.SHIPMENT_NOT_FOUND);
  }

  if (["DELIVERED", "RETURNED"].includes(shipment.status)) {
    throw new ApiError(409, "Shipment cannot be cancelled in its current state");
  }

  await cancelDelhiveryShipment(shipment.awbCode);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.shipment.update({
      where: { id: shipment.id },
      data:  { status: "FAILED" },
    });

    if (revertOrderStatus) {
      // Revert to a shippable state so the admin can re-ship. Scoped to the statuses
      // a live shipment can legitimately be in — never CANCELLED, so a concurrent
      // cancellation cannot be undone by this write.
      await tx.order.updateMany({
        where: {
          id:     orderId,
          status: { in: ["PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY"] },
        },
        data: { status: "CONFIRMED" },
      });
    }

    await createAuditLogInTx(tx, {
      userId: adminUserId,
      action:   "SHIPMENT_CANCELLED",
      entity:   "Shipment",
      entityId: shipment.id,
      newValue: { waybill: shipment.awbCode },
      req,
    });

    return { shipmentId: updated.id, status: updated.status, awbCode: shipment.awbCode };
  });
}

/**
 * The order status a courier state implies.
 *
 * `mapDelhiveryStatus` never returns SHIPPED — in-transit parcels come back as
 * IN_TRANSIT — so the "Order shipped 🚚" copy was unreachable and the order never
 * left PROCESSING. Both enums share member names, which is what made the old
 * `mapped as unknown as OrderStatus` cast look like it worked.
 */
function shipmentStatusToOrderStatus(s: ShipmentStatus): OrderStatus | null {
  switch (s) {
    case "SHIPPED":
    case "IN_TRANSIT":       return OrderStatus.SHIPPED;
    case "OUT_FOR_DELIVERY": return OrderStatus.OUT_FOR_DELIVERY;
    case "DELIVERED":        return OrderStatus.DELIVERED;
    // PENDING/PROCESSING carry no new information; FAILED and RETURNED are handled
    // separately (a failed pickup must not move the order at all).
    default:                 return null;
  }
}

/** The fulfilment ladder, used to keep courier updates strictly forward-moving. */
const FULFILMENT_SEQUENCE: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
];

/**
 * Statuses strictly earlier than `target`. Used as the WHERE for courier updates so
 * an out-of-order or replayed event cannot drag an order backwards, and so a
 * cancelled/returned/refunded order is never revived by a late scan.
 */
function ordersBehind(target: OrderStatus): OrderStatus[] {
  return FULFILMENT_SEQUENCE.slice(0, FULFILMENT_SEQUENCE.indexOf(target));
}

/**
 * Orders we consider finished. A courier still reporting movement against one of
 * these is a real-world/data mismatch someone has to look at: the parcel exists and
 * is moving, but we have closed the order and, for the refunded ones, already given
 * the money back.
 */
const CLOSED_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.CANCELLED,
  OrderStatus.RETURNED,
  OrderStatus.REFUND_INITIATED,
  OrderStatus.REFUNDED,
];

/**
 * An RTO we have already processed leaves the order in one of these, and Delhivery
 * emits several RTO scans per parcel ("RTO In Transit", "RTO Delivered", …). Those
 * repeats are normal and must not alarm — only CANCELLED is worth waking someone
 * for, because that is the one an RTO cannot auto-restore stock for.
 */
const RTO_ALARM_STATUSES: OrderStatus[] = [OrderStatus.CANCELLED];

/** The order's status if it is one of `alarming`, else null. Drives the alert. */
async function orderStatusIfIn(
  tx: Prisma.TransactionClient,
  orderId: string,
  alarming: OrderStatus[]
): Promise<string | null> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  });
  if (!order) return null;
  return alarming.includes(order.status) ? order.status : null;
}

export async function handleDelhiveryWebhookService(
  payload: any
): Promise<{ processed: boolean; message: string }> {
  // Delhivery sends two webhook shapes depending on the account/config:
  //   nested — { Shipment: { AWB, Status: { Status, StatusType, StatusDateTime } } }
  //   flat   — { wbn|mwn, status, status_type, timestamp, ... }
  // Read from whichever is present so either works.
  const shipmentNode = payload?.Shipment ?? payload?.shipment ?? {};
  const statusNode   = shipmentNode?.Status ?? {};

  const firstNonEmpty = (...vals: unknown[]): string =>
    String(vals.find((v) => v !== undefined && v !== null && v !== "") ?? "");

  const waybill = firstNonEmpty(
    shipmentNode.AWB, shipmentNode.Waybill, shipmentNode.awb,
    payload?.wbn, payload?.mwn, payload?.waybill, payload?.awb, payload?.AWB,
  );
  const statusText     = firstNonEmpty(statusNode.Status, payload?.status);
  const statusType     = firstNonEmpty(statusNode.StatusType, payload?.status_type);
  const statusDateTime = firstNonEmpty(statusNode.StatusDateTime, payload?.status_datetime, payload?.timestamp);

  if (!waybill) return { processed: false, message: "Webhook missing waybill" };

  const provider  = "delhivery";
  const eventId   = `${waybill}:${statusDateTime || statusText || statusType}`;
  const eventType = statusType || statusText || "status_update";

  let webhookEvent;
  try {
    webhookEvent = await prisma.webhookEvent.create({
      data: { provider, eventId, eventType, payload: payload as any, status: "PROCESSING" },
    });
  } catch (err: any) {
    if (err?.code === "P2002" || err?.message?.includes("Unique constraint")) {
      return { processed: false, message: "Duplicate webhook — already seen" };
    }
    throw err;
  }

  try {
    const shipment = await prisma.shipment.findFirst({
      where:   { awbCode: waybill },
      orderBy: { createdAt: "desc" },
    });

    if (!shipment) {
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data:  { status: "SKIPPED", processedAt: new Date() },
      });
      return { processed: false, message: "No shipment matches waybill" };
    }

    const mapped    = mapDelhiveryStatus(statusText, statusType);
    const delivered = mapped === "DELIVERED";
    const prevStatus = shipment.status;

    // An RTO is a parcel coming back undelivered. It is NOT a customer return: those
    // already carry a RETURN_* status and have had their refund issued by
    // resolveReturnService, so claiming here would double-restore their stock.
    let rtoClaimed = false;

    // A courier event we could not apply because the order is closed. Dropping these
    // silently is how a parcel ends up moving in the real world for an order we have
    // already cancelled or refunded, with nobody aware of it.
    let droppedForStatus: string | null = null;

    // The courier reported the parcel lost, damaged or cancelled at their end.
    let courierFailed = false;

    await prisma.$transaction(async (tx) => {
      await tx.shipment.update({
        where: { id: shipment.id },
        data: {
          // A shipment we cancelled stays cancelled. Letting a later courier scan
          // move it out of FAILED would also clear the guard below, so the next
          // event could then be treated as a live RTO.
          status:       prevStatus === "FAILED" ? "FAILED" : mapped,
          trackingData: payload as any,
          deliveredAt:  delivered
            ? (statusDateTime ? new Date(statusDateTime) : new Date())
            : shipment.deliveredAt,
        },
      });

      // `prevStatus === "FAILED"` means we already cancelled this waybill with
      // Delhivery. A late RTO scan on that dead shipment must not mark an order
      // returned when a replacement parcel is already in flight.
      if (mapped === "RETURNED" && prevStatus !== "FAILED") {
        // The claim is the idempotency guard: a repeated RTO scan arrives with a new
        // eventId, so without it the stock would be restored twice.
        const claimed = await tx.order.updateMany({
          where: {
            id: shipment.orderId,
            status: { in: ["CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY"] },
          },
          data: { status: "RETURNED" },
        });
        rtoClaimed = claimed.count > 0;

        // The goods are physically back, so the units are sellable again. An order
        // still in fulfilment never had its stock returned — this is that moment.
        if (rtoClaimed) {
          await restoreOrderStock(tx, shipment.orderId);
        } else {
          droppedForStatus = await orderStatusIfIn(tx, shipment.orderId, RTO_ALARM_STATUSES);
        }
      } else {
        // Keep the order in step with the courier. Previously only DELIVERED was
        // written, so an order sat at PROCESSING while the customer received an
        // "Out for delivery" push — the notification contradicted the order page.
        const nextOrderStatus = shipmentStatusToOrderStatus(mapped);

        // Lost / damaged / carrier-cancelled. There is no safe automatic action —
        // the goods may or may not exist — but the customer has paid and will not
        // receive them, so this must never pass silently. `prevStatus === "FAILED"`
        // means we cancelled this waybill ourselves; that is not a failure.
        if (mapped === "FAILED" && prevStatus !== "FAILED") {
          courierFailed = true;
        }

        if (nextOrderStatus) {
          const advanced = await tx.order.updateMany({
            // Forward-only, and never over a cancelled/returned/refunded order: a
            // stale courier event must not drag an order backwards or revive it.
            where: {
              id: shipment.orderId,
              status: { in: ordersBehind(nextOrderStatus) },
            },
            data: { status: nextOrderStatus },
          });

          // Nothing moved. Usually harmless — the order is already at or past this
          // point (replayed or out-of-order scan). It is only worth waking someone
          // for when the order is CLOSED, because then a live parcel is in the wild
          // for an order we consider finished and may already have refunded.
          if (advanced.count === 0) {
            droppedForStatus = await orderStatusIfIn(tx, shipment.orderId, CLOSED_ORDER_STATUSES);
          }
        }
      }
    });

    // A parcel is moving for an order we have closed. Never silent: for a CANCELLED
    // order this is also the case where an RTO cannot auto-restore stock (there is
    // no status left to claim atomically), so a human has to reconcile it.
    if (droppedForStatus) {
      await createAuditLog({
        action: "WEBHOOK_PROCESSED",
        entity: "Shipment",
        entityId: shipment.id,
        newValue: {
          dropped: true,
          reason: "ORDER_CLOSED",
          orderId: shipment.orderId,
          orderStatus: droppedForStatus,
          courierStatus: statusText,
          mapped,
          waybill,
        },
      });

      void notifyAdmins({
        type: "ADMIN_CUSTOM",
        title: "Courier update on a closed order ⚠️",
        body: `Delhivery reported "${statusText || mapped}" for order #${orderShortRef(
          shipment.orderId
        )}, which is ${droppedForStatus}. The parcel (${waybill}) may still be in transit — check stock and refunds.`,
        data: { screen: "AdminOrder", orderId: shipment.orderId },
      });
    }

    if (courierFailed) {
      await createAuditLog({
        action: "SHIPMENT_FAILED",
        entity: "Shipment",
        entityId: shipment.id,
        newValue: { orderId: shipment.orderId, courierStatus: statusText, waybill, source: "webhook" },
      });

      void notifyAdmins({
        type: "ADMIN_CUSTOM",
        title: "Parcel failed in transit ⚠️",
        body: `Delhivery reported "${statusText || mapped}" for order #${orderShortRef(
          shipment.orderId
        )} (${waybill}). The customer has paid and will not receive it — decide on a refund or a reship.`,
        data: { screen: "AdminOrder", orderId: shipment.orderId },
      });
    }

    // Undelivered goods mean the customer's money must go back.
    if (rtoClaimed) {
      // An RTO is a sale that never happened, so any commission it earned must be
      // reversed — exactly as the cancel and return-approve paths already do. This was
      // missing, so an affiliate kept their commission on every parcel that came back.
      // Its own transaction because the refund below is an external call that must not
      // hold row locks.
      const rtoOrderForReversal = await prisma.order.findUnique({
        where: { id: shipment.orderId },
        select: { userId: true, affiliateId: true },
      });
      if (rtoOrderForReversal?.affiliateId) {
        try {
          await prisma.$transaction(async (tx) => {
            await reverseAffiliateCommissionsService({
              tx,
              orderId: shipment.orderId,
              adminUserId: rtoOrderForReversal.userId,
            });
          });
        } catch (err) {
          // Never let a commission-reversal failure abandon the refund below.
          console.error(`[rto] commission reversal failed for order ${shipment.orderId}:`, err);
          void notifyAdmins({
            type: "ADMIN_CUSTOM",
            title: "Commission reversal failed ⚠️",
            body: `Order #${orderShortRef(shipment.orderId)} came back (RTO) but its affiliate commission could not be reversed. Reverse it manually.`,
            data: { screen: "AdminOrder", orderId: shipment.orderId },
          });
        }
      }

      // A refused/undelivered parcel is exactly the case the deposit exists to cover, so
      // a partial order forfeits it. Anything collected BEYOND the deposit still goes back
      // — the customer only forfeits their commitment.
      const rtoPayment = await prisma.payment.findUnique({
        where: { orderId: shipment.orderId },
        select: { status: true, balanceSettledAt: true },
      });
      const rtoOrderPlan = await prisma.order.findUnique({
        where: { id: shipment.orderId },
        select: { paymentPlan: true },
      });
      const rtoScope: RefundScope =
        rtoOrderPlan?.paymentPlan === "PARTIAL" && rtoPayment?.status === "PARTIALLY_PAID"
          ? (rtoPayment.balanceSettledAt ? "BALANCE_ONLY" : "NONE")
          : "ALL";

      const refund = await refundOrderMoney(
        shipment.orderId,
        "Parcel returned to origin (RTO)",
        { scope: rtoScope }
      );

      // `orderStatusNotification` has no RETURNED case, and an RTO needs its own
      // wording anyway — the customer never received anything.
      const rtoOrder = await prisma.order.findUnique({
        where: { id: shipment.orderId },
        select: { userId: true },
      });
      if (rtoOrder) {
        void notify({
          userId: rtoOrder.userId,
          type: refund.status === "initiated" ? "REFUND_PROCESSED" : "ORDER_CANCELLED",
          title: "Order returned to us ↩️",
          body: refund.status === "forfeited"
            ? `Order #${orderShortRef(shipment.orderId)} couldn't be delivered and came back to us. As set out in our cancellation policy, the deposit is retained. Contact support if you'd like it resent.`
            : refund.status === "initiated"
              ? `Order #${orderShortRef(shipment.orderId)} couldn't be delivered and came back to us. Your refund has been initiated.`
              : `Order #${orderShortRef(shipment.orderId)} couldn't be delivered and came back to us. Please contact support if you'd like it resent.`,
          data: { screen: "Order", orderId: shipment.orderId },
        });
      }

      void notifyAdmins({
        type: "ADMIN_CUSTOM",
        title: "Parcel returned to origin ↩️",
        body: `Order #${orderShortRef(shipment.orderId)} came back undelivered. Stock restored${
          refund.status === "initiated" ? " and the customer refunded" : ""
        }.`,
        data: { screen: "AdminOrder", orderId: shipment.orderId },
      });
    }

    // Delivery is when COD cash is actually collected — book the payment and the
    // affiliate commission. No-op for online orders and for replayed webhooks.
    if (delivered) {
      await settleOnDeliverySafe(shipment.orderId, "webhook");
    }

    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data:  { status: "PROCESSED", processedAt: new Date() },
    });

    // Notify the customer on a real courier transition (shipped / out-for-delivery /
    // delivered). Uses the same mapping as the status write, so the push and the
    // order page can no longer disagree.
    if (mapped !== prevStatus) {
      const notifyStatus = shipmentStatusToOrderStatus(mapped);
      const copy = notifyStatus ? orderStatusNotification(notifyStatus, shipment.orderId) : null;
      if (copy) {
        const order = await prisma.order.findUnique({
          where: { id: shipment.orderId },
          select: { userId: true },
        });
        if (order) {
          void notify({
            userId: order.userId,
            type: copy.type,
            title: copy.title,
            body: copy.body,
            data: {
              screen: "Order",
              orderId: shipment.orderId,
              trackingUrl: shipment.trackingUrl ?? undefined,
            },
          });
        }
      }
    }

    return { processed: true, message: "Webhook processed" };
  } catch (err: any) {
    await prisma.webhookEvent
      .update({
        where: { id: webhookEvent.id },
        data:  { status: "FAILED", error: err?.message?.substring(0, 500) ?? "Unknown error" },
      })
      .catch(() => {});
    throw err;
  }
}