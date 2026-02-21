import { prisma } from "@repo/db/client";
import { ApiError } from "../utils/api";
import { PaymentErrorCode } from "../utils/paymentErrors";
import { createAuditLog, createAuditLogInTx } from "../utils/auditLog";
import {
  createRazorpayOrder,
  verifyRazorpaySignature,
  fetchRazorpayPayment,
} from "../utils/razorpay.client";
import {
  trackShiprocketByAwb,
} from "../utils/shiprocket.client";
import { Decimal } from "decimal.js";
import type {
  CreatePaymentBody,
  VerifyPaymentBody,
  CreateCodPaymentBody,
  CreateReturnBody,
} from "@repo/zod-schema/index";
import { Request } from "express";

const MAX_PAYMENT_ATTEMPTS = 3;
const TX_RETRIES           = 3;
const RETURN_WINDOW_DAYS   = 7; // Orders eligible for return within 7 days of delivery

export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
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
      if (order.paymentMethod === "COD") {
        throw new ApiError(400, PaymentErrorCode.COD_ALREADY_SET);
      }

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

  return withRetry(async () => {
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
        return { success: true, orderId: data.orderId, alreadyProcessed: true };
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

      if (order.affiliateId) {
        await handleAffiliateCommission(tx, {
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

      return { success: true, orderId: data.orderId, alreadyProcessed: false };
    });
  });
}

export async function createCodPaymentService(
  userId: string,
  data: CreateCodPaymentBody,
  req?: Request
) {
  return withRetry(async () => {
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
      };
    });
  });
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

  await withRetry(async () => {
    await prisma.$transaction(async (tx) => {
      const payments = await tx.$queryRaw<Array<{
        id: string; orderId: string; status: string; amount: unknown;
      }>>`
        SELECT id, "orderId", status, amount
        FROM "Payment"
        WHERE "razorpayOrderId" = ${razorpayOrderId}
        FOR UPDATE
      `;

      const payment = payments[0];
      if (!payment) return; // Order not found in our system — ignore

      if (payment.status === "SUCCESS") return;

      const expectedPaise = Math.round(Number(payment.amount) * 100);
      if (amountPaise && amountPaise !== expectedPaise) {
        throw new ApiError(400, PaymentErrorCode.AMOUNT_MISMATCH);
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
        select: { affiliateId: true, total: true, userId: true },
      });
      if (order?.affiliateId) {
        await handleAffiliateCommission(tx, {
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
    });
  });
}

async function handlePaymentFailed(payload: any): Promise<void> {
  const entity          = payload?.payload?.payment?.entity;
  const razorpayOrderId = entity?.order_id;

  if (!razorpayOrderId) return;

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { razorpayOrderId },
    });
    if (!payment || payment.status === "SUCCESS") return;

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status:          "FAILED",
        gatewayResponse: entity as any,
      },
    });

    await createAuditLogInTx(tx, {
      action:   "PAYMENT_FAILED",
      entity:   "Payment",
      entityId: payment.orderId,
      newValue: {
        status:       "FAILED",
        source:       "webhook",
        errorCode:    entity?.error_code,
        errorDesc:    entity?.error_description,
      },
    });
  });
}

async function handleRefundProcessed(payload: any): Promise<void> {
  const refundEntity    = payload?.payload?.refund?.entity;
  const razorpayRefundId = refundEntity?.id;
  const paymentId       = refundEntity?.payment_id;
  const amountPaise     = refundEntity?.amount;

  if (!paymentId) return;

  await prisma.$transaction(async (tx) => {
    const payments = await tx.$queryRaw<Array<{
      id: string; orderId: string; status: string;
    }>>`
      SELECT id, "orderId", status
      FROM "Payment"
      WHERE "razorpayPaymentId" = ${paymentId}
      FOR UPDATE
    `;

    const payment = payments[0];
    if (!payment) return;
    if (payment.status === "REFUNDED") return; // Idempotent

    const refundAmount = amountPaise ? amountPaise / 100 : undefined;

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status:      "REFUNDED",
        refundId:    razorpayRefundId,
        refundAmount: refundAmount ? new Decimal(refundAmount) : undefined,
        refundedAt:  new Date(),
      },
    });

    await tx.order.update({
      where: { id: payment.orderId },
      data:  { status: "REFUNDED" },
    });

    await createAuditLogInTx(tx, {
      action:   "REFUND_SUCCESS",
      entity:   "Payment",
      entityId: payment.orderId,
      newValue: { refundId: razorpayRefundId, refundAmount, source: "webhook" },
    });
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

    const deliveredAt = order.updatedAt; // Approximation — use actual delivery date from Shipment
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

  let trackingData = shipment.trackingData;
  if (shipment.awbCode) {
    try {
      const freshTracking = await trackShiprocketByAwb(shipment.awbCode);
      trackingData = freshTracking as any;

      await prisma.shipment.update({
        where: { id: shipment.id },
        data:  { trackingData: freshTracking as any },
      });
    } catch {
     // Use cached data if Shiprocket call fails
    }
  }

  return {
    orderId,
    status:       order.status,
    awbCode:      shipment.awbCode,
    trackingUrl:  shipment.trackingUrl,
    courierName:  shipment.courierName,
    trackingData,
    shipmentStatus: shipment.status,
    estimatedAt:  shipment.estimatedAt,
    deliveredAt:  shipment.deliveredAt,
  };
}



async function handleAffiliateCommission(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  params: {
    orderId:     string;
    affiliateId: string;
    orderTotal:  number;
    userId:      string;
  }
): Promise<void> {
  const { orderId, affiliateId, orderTotal } = params;

  const affiliate = await tx.affiliate.findUnique({
    where:  { id: affiliateId },
    select: { commissionRate: true, status: true },
  });

  if (!affiliate || affiliate.status !== "APPROVED") return;

  const commissionAmount = new Decimal(orderTotal).mul(affiliate.commissionRate);

  const existingCommission = await tx.commission.findFirst({
    where: { orderId, affiliateId },
  });

  if (existingCommission) return; // Already created

  await tx.commission.create({
    data: {
      affiliateId,
      orderId,
      amount: commissionAmount,
      status: "PENDING",
    },
  });

  await tx.affiliateConversion.upsert({
    where:  { affiliateId_orderId: { affiliateId, orderId } },
    update: { commission: commissionAmount, status: "PENDING" },
    create: {
      affiliateId,
      orderId,
      commission: commissionAmount,
      status:     "PENDING",
    },
  });

  await tx.affiliate.update({
    where: { id: affiliateId },
    data: {
      totalConversions: { increment: 1 },
      totalCommission:  { increment: commissionAmount },
    },
  });

  await createAuditLogInTx(tx, {
    userId:   params.userId,
    action:   "COMMISSION_CREATED",
    entity:   "Commission",
    entityId: orderId,
    newValue: { affiliateId, commissionAmount: commissionAmount.toNumber() },
  });
}