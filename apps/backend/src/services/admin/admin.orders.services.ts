import { OrderStatus, prisma } from "@repo/db/client";
import { ApiError } from "../../utils/api";
import { OrderErrorCode } from "../../utils/orderErrors";
import { notify, notifyAdmins } from "../notification.services";
import { orderStatusNotification, orderShortRef } from "../../utils/notificationCopy";
import { cancelDelhiveryShipment } from "../../utils/delhivery.client";
import { syncProductStockFlags } from "../../utils/stock";
import { reverseAffiliateCommissionsService } from "../affiliate.services";
import { refundCapturedOrderPayment } from "../refund.services";
import { settleCodOnDelivery } from "../codSettlement.services";


/**
 * Recall the parcel when an already-dispatched order is cancelled.
 *
 * PROCESSING → CANCELLED is a permitted admin transition, but nothing told
 * Delhivery: the order read CANCELLED and was refunded while the parcel carried
 * on to the customer. Deliberately fail-soft and run after the commit — the
 * cancellation and refund are the important part, and a courier API that is down
 * must not undo them. An AWB we could not recall is escalated to admins instead.
 *
 * Not `cancelShipmentService`: that one resets the order to CONFIRMED so an admin
 * can re-ship, which would silently undo the cancellation.
 */
async function recallShipmentForCancelledOrder(orderId: string): Promise<void> {
  const shipment = await prisma.shipment.findFirst({
    where: {
      orderId,
      awbCode: { not: null },
      status: { notIn: ["DELIVERED", "RETURNED", "FAILED"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!shipment?.awbCode) return;

  try {
    await cancelDelhiveryShipment(shipment.awbCode);
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: { status: "FAILED" },
    });
  } catch (err: any) {
    console.error(`[admin-cancel] could not recall AWB ${shipment.awbCode}:`, err?.message ?? err);
    void notifyAdmins({
      type: "ADMIN_CUSTOM",
      title: "Parcel still in transit ⚠️",
      body: `Order #${orderShortRef(orderId)} was cancelled but Delhivery would not cancel AWB ${shipment.awbCode}. Recall it manually.`,
      data: { screen: "AdminOrder", orderId },
    });
  }
}

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

/**
 * One order, with everything the admin detail screen needs.
 *
 * There was no by-id endpoint at all, so the detail page paged through the LIST
 * endpoint looking for a match — and that payload carries only user and payment,
 * which is why product lines and the delivery address never appeared.
 */
export async function getAdminOrderByIdService(id: string) {
  const order = await prisma.order.findFirst({
    where: { id, deletedAt: null },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      address: true,
      payment: true,
      coupon: { select: { code: true } },
      shipments: { orderBy: { createdAt: "desc" } },
      items: {
        include: {
          product: { select: { id: true, name: true, slug: true } },
          variant: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!order) throw new ApiError(404, OrderErrorCode.ORDER_NOT_FOUND);

  return {
    ...order,
    subtotal: order.subtotal.toNumber(),
    discount: order.discount.toNumber(),
    shippingCharges: order.shippingCharges.toNumber(),
    total: order.total.toNumber(),
    payment: order.payment
      ? { ...order.payment, amount: order.payment.amount.toNumber() }
      : null,
    items: order.items.map((item) => ({ ...item, price: item.price.toNumber() })),
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
    // Recall the parcel BEFORE refunding, so a cancelled-and-refunded order can
    // never still be travelling to the customer without us knowing about it.
    await recallShipmentForCancelledOrder(id);
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
