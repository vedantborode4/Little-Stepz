import { OrderStatus, prisma } from "@repo/db/client";
import { ApiError } from "../../utils/api";
import { OrderErrorCode } from "../../utils/orderErrors";
import { notify } from "../notification.services";
import { orderStatusNotification } from "../../utils/notificationCopy";
import { syncProductStockFlags } from "../../utils/stock";
import { reverseAffiliateCommissionsService } from "../affiliate.services";
import { refundCapturedOrderPayment } from "../refund.services";
import { settleCodOnDelivery } from "../codSettlement.services";


const statusTransitions: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.OUT_FOR_DELIVERY],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [OrderStatus.RETURN_REQUESTED],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.RETURN_REQUESTED]: [OrderStatus.RETURN_APPROVED, OrderStatus.RETURN_REJECTED],
  [OrderStatus.RETURN_APPROVED]: [OrderStatus.RETURNED, OrderStatus.REFUND_INITIATED],
  [OrderStatus.RETURN_REJECTED]: [],
  [OrderStatus.RETURNED]: [OrderStatus.REFUND_INITIATED],
  [OrderStatus.REFUND_INITIATED]: [OrderStatus.REFUNDED],
  [OrderStatus.REFUNDED]: [],
};


export async function getAdminOrdersService(
  page: number,
  limit: number,
  status?: OrderStatus,
  fromDate?: Date,
  toDate?: Date
) {
  const skip = (page - 1) * limit;

  const where: {
    deletedAt: null;
    status?: OrderStatus;
    createdAt?: {
      gte?: Date;
      lte?: Date;
    };
  } = {
    deletedAt: null,
  };

  if (status) {
    where.status = status;
  }

  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt.gte = fromDate;
    if (toDate) where.createdAt.lte = toDate;
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true } },
        payment: { select: { status: true, amount: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders: orders.map((order) => ({
      ...order,
      subtotal: order.subtotal.toNumber(),
      discount: order.discount.toNumber(),
      shippingCharges: order.shippingCharges.toNumber(),
      total: order.total.toNumber(),
      payment: order.payment
        ? {
            ...order.payment,
            amount: order.payment.amount.toNumber(),
          }
        : null,
    })),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}

export async function updateOrderStatusService(
  id: string,
  newStatus: OrderStatus,
  adminId: string
) {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id },
      include: {
        items: true,
        coupon: true,
        commissions: true,
      },
    });

    if (!order || order.deletedAt) {
      throw new ApiError(404, OrderErrorCode.ORDER_NOT_FOUND);
    }

    const allowedTransitions = statusTransitions[order.status];

    if (!allowedTransitions.includes(newStatus)) {
      throw new ApiError(400, OrderErrorCode.INVALID_STATUS_TRANSITION);
    }

    const updated = await tx.order.update({
      where: { id },
      data: { status: newStatus },
    });

    if (
      newStatus === OrderStatus.CANCELLED &&
      (order.status === OrderStatus.PENDING ||
        order.status === OrderStatus.CONFIRMED)
    ) {
      // Restore stock
      for (const item of order.items) {
        if (item.variantId) {
          await tx.variant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          });
        } else {
          await tx.product.update({
            where: { id: item.productId },
            data: { quantity: { increment: item.quantity } },
          });
        }
      }

      // Returning stock can bring a sold-out product back in stock. Without this the
      // numbers recover but `inStock` stays false, leaving the product unbuyable.
      await syncProductStockFlags(tx, order.items.map((i) => i.productId));

      // Give the coupon use back, otherwise a cancelled order permanently consumes
      // a slot against the coupon's usage limit.
      if (order.couponId) {
        await tx.coupon.updateMany({
          where: { id: order.couponId, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        });
      }

      // Close out a payment that was never collected. The customer cancel path
      // already did this; the admin path left a cancelled COD order sitting on a
      // PENDING payment, as though the money were still owed.
      await tx.payment.updateMany({
        where: { orderId: id, status: { in: ["PENDING", "INITIATED"] } },
        data: { status: "FAILED" },
      });

      // Reverse commissions through the shared helper. The previous inline
      // updateMany flipped the commission rows but never decremented the
      // affiliate's totalCommission/pendingBalance, so cancelled orders left the
      // affiliate's payable balance permanently inflated.
      await reverseAffiliateCommissionsService({ tx, orderId: id, adminUserId: adminId });
    }


    return {
      ...updated,
      subtotal: updated.subtotal.toNumber(),
      discount: updated.discount.toNumber(),
      shippingCharges: updated.shippingCharges.toNumber(),
      total: updated.total.toNumber(),
    };
  });

  // Both of these make their own external/DB calls and so run after the commit.
  let refund: Awaited<ReturnType<typeof refundCapturedOrderPayment>> = { status: "none" };

  if (newStatus === OrderStatus.CANCELLED) {
    refund = await refundCapturedOrderPayment(id, "Order cancelled by admin");
  }

  if (newStatus === OrderStatus.DELIVERED) {
    await settleCodOnDelivery(id);
  }

  const copy = orderStatusNotification(newStatus, result.id);
  if (copy) {
    void notify({
      userId: result.userId,
      type: copy.type,
      title: copy.title,
      body: refund.status === "initiated"
        ? `${copy.body} Your refund has been initiated.`
        : copy.body,
      data: { screen: "Order", orderId: result.id },
    });
  }

  return { ...result, refund: refund.status };
}
