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
import { orderShortRef, money, orderStatusNotification } from "../utils/notificationCopy";
import { Decimal } from "decimal.js";
import type {
  CreatePaymentBody,
  VerifyPaymentBody,
  CreateCodPaymentBody,
  CreateReturnBody,
  ResolveReturnBody,
} from "@repo/zod-schema/index";
import { Request } from "express";
import { releasePendingOrderStock } from "../utils/pendingRelease";
import { settleCodOnDelivery } from "./codSettlement.services";
import { refundCapturedOrderPayment } from "./refund.services";
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
  opts: { paid: boolean }
) {
  if (opts.paid) {
    void notify({
      userId,
      type: "PAYMENT_SUCCESS",
      title: "Payment received 💳",
      body: `We've received your payment of ${money(total)} for order #${orderShortRef(orderId)}.`,
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
        err?.message?.includes("Transaction failed");

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

export async function createPaymentService(
  userId: string,
  data: CreatePaymentBody,
  req?: Request
) {
  return withRetry(async () => {
    return prisma.$transaction(async (tx) => {

      const orders = await tx.$queryRaw<Array<{
        id: string; userId: string; total: unknown;
        status: string; paymentMethod: string;
      }>>`
        SELECT id, "userId", total, status, "paymentMethod"
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
      // Deliberately no COD guard here. A confirmed COD order is already rejected
      // above — `createCodPaymentService` flips the order to CONFIRMED in the same
      // transaction it writes the COD payment, so a PENDING order can never have a
      // settled COD payment. What remains is a customer who chose COD, did not go
      // through with it, and is now paying online; that must work, because the order
      // is replayed under the same idempotency key. The method is corrected below.

      const existingPayment = await tx.payment.findUnique({
        where: { orderId: data.orderId },
      });

      if (existingPayment) {
        if (existingPayment.status === "SUCCESS") {
          throw new ApiError(409, PaymentErrorCode.PAYMENT_ALREADY_SUCCEEDED);
        }
        if (existingPayment.attempts >= MAX_PAYMENT_ATTEMPTS) {
          throw new ApiError(429, PaymentErrorCode.PAYMENT_MAX_ATTEMPTS);
        }
        if (existingPayment.razorpayOrderId && existingPayment.status === "INITIATED") {
          return {
            razorpayOrderId: existingPayment.razorpayOrderId,
            orderId:         data.orderId,
            amount:          Number(order.total),
            currency:        "INR",
            keyId:           process.env.RAZORPAY_KEY_ID,
          };
        }
        await tx.payment.update({
          where: { orderId: data.orderId },
          data: {
            attempts: { increment: 1 },
            status:   "INITIATED",
          },
        });
      }

      const totalAmount = Number(order.total);

      let razorpayOrder;
      try {
        razorpayOrder = await createRazorpayOrder({
          amount:   totalAmount,
          currency: "INR",
          receipt:  data.orderId.substring(0, 40),
          notes:    { orderId: data.orderId, userId },
        });
      } catch (err: any) {
        throw new ApiError(502, PaymentErrorCode.RAZORPAY_ORDER_CREATE_FAILED);
      }

      if (existingPayment) {
        await tx.payment.update({
          where: { orderId: data.orderId },
          data: {
            razorpayOrderId: razorpayOrder.id,
            status:          "INITIATED",
            gatewayResponse: razorpayOrder as any,
          },
        });
      } else {
        await tx.payment.create({
          data: {
            orderId:         data.orderId,
            method:          "ONLINE",
            gateway:         "razorpay",
            razorpayOrderId: razorpayOrder.id,
            amount:          new Decimal(totalAmount),
            currency:        "INR",
            status:          "INITIATED",
            attempts:        1,
            gatewayResponse: razorpayOrder as any,
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

      await createAuditLogInTx(tx, {
        userId,
        action:   "PAYMENT_INITIATED",
        entity:   "Payment",
        entityId: data.orderId,
        newValue: { razorpayOrderId: razorpayOrder.id, amount: totalAmount },
        req,
      });

      return {
        razorpayOrderId: razorpayOrder.id,
        orderId:         data.orderId,
        amount:          totalAmount,
        currency:        "INR",
        keyId:           process.env.RAZORPAY_KEY_ID,
      };
    });
  });
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
  }
): Promise<{ refunded: boolean }> {
  let refundId: string | null = null;
  try {
    const refund = await initiateRazorpayRefund({
      paymentId: params.razorpayPaymentId,
      amount:    params.amount,
      notes:     { orderId: params.orderId, reason: "Order no longer active" },
    });
    refundId = refund.id;
  } catch {
    refundId = null;
  }

  await tx.payment.update({
    where: { id: params.paymentId },
    data: refundId
      ? {
          status:            "REFUND_INITIATED",
          razorpayPaymentId: params.razorpayPaymentId,
          gatewayResponse:   params.gatewayResponse as any,
          refundId,
          refundAmount:      new Decimal(params.amount),
          refundReason:      "Order cancelled before payment completed",
        }
      : {
          status:            "SUCCESS",
          razorpayPaymentId: params.razorpayPaymentId,
          gatewayResponse:   params.gatewayResponse as any,
        },
  });

  await createAuditLogInTx(tx, {
    action:   refundId ? "REFUND_INITIATED" : "REFUND_FAILED",
    entity:   "Payment",
    entityId: params.orderId,
    newValue: {
      reason:      "ORDER_NOT_PENDING",
      orderStatus: params.orderStatus,
      source:      params.source,
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
      ? `Order #${orderShortRef(orderId)} had already been cancelled, so your payment has been refunded. It should reach you in 5–7 working days.`
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

      if (payment.status === "SUCCESS") {
        return { success: true, orderId: data.orderId, alreadyProcessed: true, total: 0, commission: null, orphaned: false, refunded: false };
      }

      if (payment.razorpayOrderId !== data.razorpayOrderId) {
        throw new ApiError(400, PaymentErrorCode.RAZORPAY_ORDER_ID_MISMATCH);
      }

      let razorpayPayment;
      try {
        razorpayPayment = await fetchRazorpayPayment(data.razorpayPaymentId);
      } catch {
        throw new ApiError(502, "Failed to fetch payment from Razorpay");
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
        total: unknown;
      }>>`
        SELECT id, "userId", status, "affiliateId", total
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

      await tx.payment.update({
        where: { orderId: data.orderId },
        data: {
          status:            "SUCCESS",
          razorpayPaymentId: data.razorpayPaymentId,
          razorpaySignature: data.razorpaySignature,
          gatewayResponse:   razorpayPayment as any,
        },
      });

      await tx.order.update({
        where: { id: data.orderId },
        data:  { status: "CONFIRMED" },
      });

      // Clear the cart only now that payment is confirmed — see orders.services.ts.
      await tx.cartItem.updateMany({
        where: { userId, deletedAt: null },
        data:  { deletedAt: new Date() },
      });

      let commission = null;
      if (order.affiliateId) {
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
        action:   "PAYMENT_SUCCESS",
        entity:   "Payment",
        entityId: data.orderId,
        oldValue: { status: payment.status },
        newValue: { status: "SUCCESS", razorpayPaymentId: data.razorpayPaymentId },
        req,
      });

      return { success: true, orderId: data.orderId, alreadyProcessed: false, total: Number(order.total), commission, orphaned: false, refunded: false };
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
    emitOrderConfirmed(userId, result.orderId, result.total, { paid: true });
    emitCommissionEarned(result.commission, result.orderId);
  }

  return { success: result.success, orderId: result.orderId, alreadyProcessed: result.alreadyProcessed };
}

export async function createCodPaymentService(
  userId: string,
  data: CreateCodPaymentBody,
  req?: Request
) {
  const result = await withRetry(async () => {
    return prisma.$transaction(async (tx) => {
      const orders = await tx.$queryRaw<Array<{
        id: string; userId: string; total: unknown; status: string;
        paymentMethod: string;
      }>>`
        SELECT id, "userId", total, status, "paymentMethod"
        FROM "Order"
        WHERE id = ${data.orderId}
        FOR UPDATE
      `;

      const order = orders[0];
      if (!order) throw new ApiError(404, PaymentErrorCode.ORDER_NOT_FOUND);
      if (order.userId !== userId) throw new ApiError(403, PaymentErrorCode.UNAUTHORIZED_ACCESS);
      if (order.status !== "PENDING") throw new ApiError(400, PaymentErrorCode.ORDER_NOT_PENDING);

      const existingPayment = await tx.payment.findUnique({
        where: { orderId: data.orderId },
      });
      if (existingPayment) {
        if (existingPayment.status === "SUCCESS" || existingPayment.method === "COD") {
          throw new ApiError(409, PaymentErrorCode.COD_ALREADY_SET);
        }
      }

      const totalAmount = Number(order.total);

      const maxCodAmount = Number(process.env.COD_MAX_AMOUNT ?? "10000");
      if (totalAmount > maxCodAmount) {
        throw new ApiError(400, PaymentErrorCode.COD_NOT_AVAILABLE);
      }

      if (existingPayment) {
        await tx.payment.update({
          where: { orderId: data.orderId },
          data: {
            method:  "COD",
            gateway: "cod",
            status:  "PENDING", // Pending until delivered
          },
        });
      } else {
        await tx.payment.create({
          data: {
            orderId: data.orderId,
            method:  "COD",
            gateway: "cod",
            amount:  new Decimal(totalAmount),
            currency: "INR",
            status:  "PENDING",
          },
        });
      }

      await tx.order.update({
        where: { id: data.orderId },
        data: {
          paymentMethod: "COD",
          status:        "CONFIRMED",
        },
      });

      // Clear the cart only now that the order is confirmed — see orders.services.ts.
      await tx.cartItem.updateMany({
        where: { userId, deletedAt: null },
        data:  { deletedAt: new Date() },
      });

      await createAuditLogInTx(tx, {
        userId,
        action:   "PAYMENT_COD_CREATED",
        entity:   "Payment",
        entityId: data.orderId,
        newValue: { method: "COD", amount: totalAmount },
        req,
      });

      return {
        success:       true,
        orderId:       data.orderId,
        paymentMethod: "COD",
        message:       "Cash on Delivery confirmed. Pay on delivery.",
        total:         Number(order.total),
      };
    });
  });

  emitOrderConfirmed(userId, result.orderId, result.total, { paid: false });

  const { total, ...response } = result;
  return response;
}

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
      if (existing?.status === "PROCESSED") {
        return { processed: false, message: "Duplicate webhook — already processed" };
      }
      return { processed: false, message: "Duplicate webhook — in progress" };
    }
    throw err;
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

      if (payment.status === "SUCCESS") return null;

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

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status:            "SUCCESS",
          razorpayPaymentId,
          gatewayResponse:   entity as any,
        },
      });

      await tx.order.update({
        where: { id: payment.orderId },
        data:  { status: "CONFIRMED" },
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

      let commission = null;
      if (order?.affiliateId) {
        commission = await processAffiliateCommissionService({
          tx,
          orderId:     payment.orderId,
          affiliateId: order.affiliateId,
          orderTotal:  Number(order.total),
          userId:      order.userId,
        });
      }

      await createAuditLogInTx(tx, {
        action:   "PAYMENT_SUCCESS",
        entity:   "Payment",
        entityId: payment.orderId,
        oldValue: { status: payment.status },
        newValue: { status: "SUCCESS", source: "webhook", razorpayPaymentId },
      });

      return order
        ? { orphaned: false as const, refunded: false, userId: order.userId, orderId: payment.orderId, total: Number(order.total), commission }
        : null;
    });
  });

  if (confirmed?.orphaned) {
    emitOrphanedCaptureNotice(confirmed.userId, confirmed.orderId, confirmed.refunded);
  } else if (confirmed) {
    emitOrderConfirmed(confirmed.userId, confirmed.orderId, confirmed.total, { paid: true });
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

async function handleRefundProcessed(payload: any): Promise<void> {
  const refundEntity    = payload?.payload?.refund?.entity;
  const razorpayRefundId = refundEntity?.id;
  const paymentId       = refundEntity?.payment_id;
  const amountPaise     = refundEntity?.amount;

  if (!paymentId) return;

  const refunded = await prisma.$transaction(async (tx) => {
    const payments = await tx.$queryRaw<Array<{
      id: string; orderId: string; status: string; amount: unknown;
    }>>`
      SELECT id, "orderId", status, amount
      FROM "Payment"
      WHERE "razorpayPaymentId" = ${paymentId}
      FOR UPDATE
    `;

    const payment = payments[0];
    if (!payment) return null;
    if (payment.status === "REFUNDED") return null; // Idempotent

    const refundAmount = amountPaise ? amountPaise / 100 : undefined;

    // A partial refund must not mark the whole payment (and the whole order)
    // refunded. `resolveReturnService` can refund less than the captured amount,
    // and this previously flipped a ₹2000 order to REFUNDED over a ₹100 return.
    // Comparing this refund against the captured amount is sufficient because the
    // app never issues more than one refund per payment — resolveReturn refuses a
    // second, and the cancellation path claims SUCCESS -> REFUND_INITIATED atomically.
    const isFullRefund =
      refundAmount === undefined || refundAmount >= Number(payment.amount) - 0.01;

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status:      isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED",
        refundId:    razorpayRefundId,
        refundAmount: refundAmount ? new Decimal(refundAmount) : undefined,
        refundedAt:  new Date(),
      },
    });

    // Only a full refund unwinds the order. A partially refunded order keeps the
    // status its return/cancellation flow gave it.
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
      newValue: { refundId: razorpayRefundId, refundAmount, partial: !isFullRefund, source: "webhook" },
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
  return withRetry(async () => {
    return prisma.$transaction(async (tx) => {
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

          const refundAmount = data.refundAmount ?? Number(payment.amount);

          let refund;
          try {
            refund = await initiateRazorpayRefund({
              paymentId: payment.razorpayPaymentId,
              amount:    refundAmount,
              notes:     { orderId: returnReq.orderId, reason: "Return approved" },
            });
          } catch (err: any) {
            throw new ApiError(502, PaymentErrorCode.REFUND_FAILED);
          }

          await tx.payment.update({
            where: { orderId: returnReq.orderId },
            data: {
              status:       "REFUND_INITIATED",
              refundId:     refund.id,
              refundAmount: new Decimal(refundAmount),
              refundReason: data.adminNote ?? "Return approved",
            },
          });

          await tx.return.update({
            where: { id: returnId },
            data: {
              refundAmount: new Decimal(refundAmount),
            },
          });

          await createAuditLogInTx(tx, {
            userId: adminUserId,
            action:   "REFUND_INITIATED",
            entity:   "Payment",
            entityId: returnReq.orderId,
            newValue: { refundId: refund.id, refundAmount, source: "admin" },
            req,
          });
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
      };
    });
  });
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
      paymentMode: order.paymentMethod === "COD" ? "COD" : "Prepaid",
      codAmount:   Number(order.total),
      totalAmount: Number(order.total),
      productsDesc,
      quantity:    totalQuantity,
    });
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(502, PaymentErrorCode.DELHIVERY_ORDER_FAILED);
  }

  const trackingUrl = `https://www.delhivery.com/track/package/${delhiveryResponse.waybill}`;

  const result = await prisma.$transaction(async (tx) => {
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

    await tx.order.update({
      where: { id: orderId },
      data: {
        status:             "PROCESSING",
        providerRefId:      delhiveryResponse.refnum,
        providerShipmentId: delhiveryResponse.waybill,
        awbCode:            delhiveryResponse.waybill,
        trackingUrl,
      },
    });

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

  void notify({
    userId: order.userId,
    type: "ORDER_PROCESSING",
    title: "Order is being packed 📦",
    body: `Your order #${orderShortRef(orderId)} has been handed to Delhivery. You can track it now.`,
    data: { screen: "Order", orderId, trackingUrl },
  });

  return result;
}

export async function cancelShipmentService(
  adminUserId: string,
  orderId:     string,
  req?:        Request
) {
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

    // Revert to a shippable state so the admin can re-ship.
    await tx.order.update({
      where: { id: orderId },
      data:  { status: "CONFIRMED" },
    });

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
      const refund = await refundCapturedOrderPayment(
        shipment.orderId,
        "Parcel returned to origin (RTO)"
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
          body: refund.status === "initiated"
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
      await settleCodOnDelivery(shipment.orderId).catch((err) =>
        console.error("[webhook] COD settlement failed:", err)
      );
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