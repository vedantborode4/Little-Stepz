import { OrderStatus, prisma } from "@repo/db/client";
import { ApiError } from "../../utils/api";
import { OrderErrorCode } from "../../utils/orderErrors";
import { notify, notifyAdmins } from "../notification.services";
import { orderStatusNotification, orderShortRef } from "../../utils/notificationCopy";
import { cancelShipmentService } from "../payment.services";
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

/**
 * Pull a manifested parcel back when its order is cancelled. Never throws: the
 * cancellation is already committed, and a courier-side failure is an operational
 * problem for a human, not a reason to report the cancellation as failed.
 */
async function cancelWaybillForCancelledOrder(orderId: string, adminId: string): Promise<void> {
  const live = await prisma.shipment.findFirst({
    where: {
      orderId,
      awbCode: { not: null },
      // A cancelled shipment is recorded as FAILED — there is no CANCELLED state.
      status:  { notIn: ["FAILED", "DELIVERED", "RETURNED"] },
    },
    select: { awbCode: true },
  });

  if (!live) return;

  try {
    await cancelShipmentService(adminId, orderId);
  } catch (err: any) {
    console.error(`[cancel] waybill ${live.awbCode} for order ${orderId}:`, err?.message ?? err);

    void notifyAdmins({
      type:  "ADMIN_CUSTOM",
      title: "Waybill still live ⚠️",
      body: `Order #${orderShortRef(orderId)} was cancelled but Delhivery waybill ${live.awbCode} could not be cancelled. Cancel it manually before the parcel ships.`,
      data:  { screen: "AdminOrder", orderId },
    });
  }
}

/**
 * One order, everything an admin needs to fulfil or dispute it.
 *
 * There was no detail endpoint at all: both clients rebuilt the "order detail"
 * screen out of the paginated list payload, which carries only `user` and
 * `payment`. So the items table was always empty and the delivery address was
 * never fetched — the admin saw an order total and nothing else.
 *
 * Item names come from the `productName`/`variantName` snapshots taken at order
 * time, falling back to the live relation only for rows written before those
 * columns existed. Reading the live name here would reintroduce exactly the
 * history-rewriting that the snapshots were added to prevent.
 */
export async function getAdminOrderByIdService(id: string) {
  const order = await prisma.order.findFirst({
    where: { id, deletedAt: null },
    include: {
      user:    { select: { id: true, name: true, email: true, phone: true } },
      address: true,
      coupon:  { select: { code: true, type: true, value: true } },
      // Explicit: `payment: true` would ship the Razorpay signature and the raw
      // gateway response to the browser, neither of which the panel renders.
      payment: {
        select: {
          id: true, method: true, gateway: true, status: true, amount: true,
          currency: true, razorpayOrderId: true, razorpayPaymentId: true,
          refundId: true, refundAmount: true, refundedAt: true, refundReason: true,
          codCollectedAt: true, attempts: true, createdAt: true,
        },
      },
      shipments: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true, awbCode: true, courierName: true, trackingUrl: true,
          status: true, estimatedAt: true, deliveredAt: true, createdAt: true,
        },
      },
      items: {
        where: { deletedAt: null },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              images: {
                where: { variantId: null, deletedAt: null },
                orderBy: { sortOrder: "asc" },
                take: 1,
                select: { url: true },
              },
            },
          },
          variant: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!order) throw new ApiError(404, OrderErrorCode.ORDER_NOT_FOUND);

  return {
    ...order,
    subtotal:        order.subtotal.toNumber(),
    discount:        order.discount.toNumber(),
    shippingCharges: order.shippingCharges.toNumber(),
    total:           order.total.toNumber(),
    coupon: order.coupon
      ? { ...order.coupon, value: order.coupon.value.toNumber() }
      : null,
    payment: order.payment
      ? {
          ...order.payment,
          amount:       order.payment.amount.toNumber(),
          refundAmount: order.payment.refundAmount?.toNumber() ?? null,
        }
      : null,
    items: order.items.map((item) => ({
      ...item,
      price:       item.price.toNumber(),
      subtotal:    item.price.toNumber() * item.quantity,
      productName: item.productName ?? item.product.name,
      variantName: item.variantName ?? item.variant?.name ?? null,
      image:       item.product.images[0]?.url ?? null,
      productSlug: item.product.slug,
    })),
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
    // A PROCESSING order has already been manifested with Delhivery. Cancelling it
    // in our DB without cancelling the waybill left a live parcel that would still
    // ship — the stock was returned and the customer refunded while the goods went
    // out. Best-effort: a courier that refuses the cancellation must not fail the
    // cancellation itself, so the admin is told to pull it manually instead.
    await cancelWaybillForCancelledOrder(id, adminId);
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
