import { OrderStatus, prisma } from "@repo/db/client";
import { ApiError } from "../../utils/api";
import { OrderErrorCode } from "../../utils/orderErrors";


const statusTransitions: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
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
  return prisma.$transaction(async (tx) => {
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

      // Reverse unpaid commissions
      await tx.commission.updateMany({
        where: {
          orderId: id,
          status: { not: "PAID" },
        },
        data: { status: "CANCELLED" },
      });
    }


    return {
      ...updated,
      subtotal: updated.subtotal.toNumber(),
      discount: updated.discount.toNumber(),
      shippingCharges: updated.shippingCharges.toNumber(),
      total: updated.total.toNumber(),
    };
  });
}
