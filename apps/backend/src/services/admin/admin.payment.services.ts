import { prisma } from "@repo/db/client";
import { ApiError } from "../../utils/api";
import { PaymentErrorCode } from "../../utils/paymentErrors";
import { createAuditLogInTx } from "../../utils/auditLog";
import {
  initiateRazorpayRefund,
} from "../../utils/razorpay.client";
import {
  createShiprocketOrder,
  buildShiprocketPayload,
} from "../../utils/shiprocket.client";
import { Decimal } from "decimal.js";
import type {
  ResolveReturnBody,
} from "@repo/zod-schema/index";
import { Request } from "express";
import { withRetry } from "../payment.services";


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

        await reverseAffiliateCommissions(tx, returnReq.orderId, adminUserId);
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

export async function createShipmentService(
  adminUserId: string,
  orderId:     string,
  req?:        Request
) {
  const order = await prisma.order.findUnique({
    where:   { id: orderId, deletedAt: null },
    include: {
      address:    true,
      items:      { include: { product: true } },
      payment:    true,
      shipments:  true,
    },
  });

  if (!order) throw new ApiError(404, PaymentErrorCode.ORDER_NOT_FOUND);

  if (!["CONFIRMED", "PROCESSING"].includes(order.status)) {
    throw new ApiError(400, "Order is not in a shippable state");
  }

  if (order.shipments.length > 0 && order.shipments[0]!.shiprocketOrderId) {
    throw new ApiError(409, "Shipment already created for this order");
  }

  const payload = buildShiprocketPayload({
    orderId:       order.id,
    orderDate:     order.createdAt,
    address:       order.address,
    items:         order.items.map((item) => ({
      productId:  item.productId,
      name:       item.product.name,
      quantity:   item.quantity,
      price:      Number(item.price),
      variantId:  item.variantId ?? undefined,
    })),
    total:         Number(order.total),
    paymentMethod: order.paymentMethod,
  });

  let shiprocketResponse;
  try {
    shiprocketResponse = await createShiprocketOrder(payload);
  } catch (err: any) {
    throw new ApiError(502, PaymentErrorCode.SHIPROCKET_ORDER_FAILED);
  }

  return prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.create({
      data: {
        orderId,
        shiprocketOrderId:    String(shiprocketResponse.order_id),
        shiprocketShipmentId: String(shiprocketResponse.shipment_id),
        awbCode:              shiprocketResponse.awb_code,
        courierName:          shiprocketResponse.courier_name,
        trackingUrl:          shiprocketResponse.awb_code
          ? `https://shiprocket.co/tracking/${shiprocketResponse.awb_code}`
          : null,
        status:      "PROCESSING",
        trackingData: shiprocketResponse as any,
      },
    });

    // Update order
    await tx.order.update({
      where: { id: orderId },
      data: {
        status:               "PROCESSING",
        shiprocketOrderId:    String(shiprocketResponse.order_id),
        shiprocketShipmentId: String(shiprocketResponse.shipment_id),
        awbCode:              shiprocketResponse.awb_code,
        trackingUrl:          shipment.trackingUrl,
      },
    });

    await createAuditLogInTx(tx, {
      userId: adminUserId,
      action:   "SHIPMENT_CREATED",
      entity:   "Shipment",
      entityId: shipment.id,
      newValue: {
        shiprocketOrderId: shiprocketResponse.order_id,
        awbCode:           shiprocketResponse.awb_code,
      },
      req,
    });

    return {
      shipmentId:           shipment.id,
      shiprocketOrderId:    shiprocketResponse.order_id,
      shiprocketShipmentId: shiprocketResponse.shipment_id,
      awbCode:              shiprocketResponse.awb_code,
      courierName:          shiprocketResponse.courier_name,
      trackingUrl:          shipment.trackingUrl,
    };
  });
}

async function reverseAffiliateCommissions(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  orderId:     string,
  adminUserId: string
): Promise<void> {
  const commissions = await tx.commission.findMany({
    where: { orderId, status: { in: ["PENDING", "APPROVED"] } },
  });

  for (const commission of commissions) {
    await tx.commission.update({
      where: { id: commission.id },
      data: {
        status:         "CANCELLED",
        reversedAt:     new Date(),
        reversalReason: "Refund issued",
      },
    });

    await tx.affiliate.update({
      where: { id: commission.affiliateId },
      data: {
        totalCommission: { decrement: commission.amount },
      },
    });

    await createAuditLogInTx(tx, {
      userId:   adminUserId,
      action:   "COMMISSION_REVERSED",
      entity:   "Commission",
      entityId: commission.id,
      oldValue: { status: commission.status, amount: commission.amount.toNumber() },
      newValue: { status: "CANCELLED", reversalReason: "Refund issued" },
    });
  }

  await tx.affiliateConversion.updateMany({
    where: { orderId, status: { in: ["PENDING", "APPROVED"] } },
    data:  { status: "CANCELLED" },
  });
}
