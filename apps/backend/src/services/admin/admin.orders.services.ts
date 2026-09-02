import { OrderStatus, prisma } from "@repo/db/client";
import { ApiError } from "../../utils/api";
import { OrderErrorCode } from "../../utils/orderErrors";
import { notify, notifyAdmins } from "../notification.services";
import { orderStatusNotification, orderShortRef } from "../../utils/notificationCopy";
import { cancelShipmentService } from "../payment.services";
import { syncProductStockFlags } from "../../utils/stock";
import { reverseAffiliateCommissionsService } from "../affiliate.services";
import { refundOrderMoney, type RefundScope } from "../refund.services";
import { settleOnDeliverySafe } from "../codSettlement.services";
import { issueInvoiceForOrder } from "../invoice.services";
import { createAuditLog } from "../../utils/auditLog";
import type { Request } from "express";


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
  toDate?: Date,
  /**
   * Narrow to partial-payment orders, optionally by whether money is still owed.
   * "due" is the operational queue — what a human has to chase or collect.
   */
  paymentPlan?: "FULL" | "PARTIAL",
  balanceState?: "due" | "settled"
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

  if (paymentPlan) (where as Record<string, unknown>).paymentPlan = paymentPlan;

  // Outstanding means the deposit landed and nothing has settled the balance since.
  // Expressed through Payment rather than an Order column so it cannot drift from the
  // status the settlement path actually writes.
  if (balanceState === "due") {
    (where as Record<string, unknown>).paymentPlan = "PARTIAL";
    (where as Record<string, unknown>).depositPaidAt = { not: null };
    (where as Record<string, unknown>).payment = {
      is: { status: "PARTIALLY_PAID", balanceSettledAt: null },
    };
  } else if (balanceState === "settled") {
    (where as Record<string, unknown>).paymentPlan = "PARTIAL";
    (where as Record<string, unknown>).payment = { is: { status: "SUCCESS" } };
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true } },
        payment: { select: { status: true, amount: true, balanceSettledAt: true } },
        // The admin "Resolve Return" action addresses the Return, not the Order —
        // `PUT /admin/returns/:id/resolve`. The row was never sent one, so the button
        // posted `undefined` as the id and the flow could not work at all.
        // Return.orderId is @unique, so there is at most one.
        returns: { select: { id: true, status: true }, take: 1 },
      },
    }),
    prisma.order.count({ where }),
  ]);

  // What the whole filtered set still owes — the number an operator actually wants,
  // rather than the sum of whatever happens to be on this page.
  const outstanding = await prisma.order.aggregate({
    where: {
      ...where,
      paymentPlan: "PARTIAL",
      depositPaidAt: { not: null },
      payment: { is: { status: "PARTIALLY_PAID", balanceSettledAt: null } },
    },
    _sum: { balanceAmount: true },
    _count: { id: true },
  });

  return {
    orders: orders.map(({ returns, ...order }) => ({
      ...order,
      subtotal: order.subtotal.toNumber(),
      discount: order.discount.toNumber(),
      shippingCharges: order.shippingCharges.toNumber(),
      total: order.total.toNumber(),
      returnId: returns[0]?.id ?? null,
      returnStatus: returns[0]?.status ?? null,
      // Surfaced on the list so outstanding money is visible without opening each order.
      balanceOutstanding:
        order.paymentPlan === "PARTIAL" &&
        order.payment?.status !== "SUCCESS" &&
        !order.payment?.balanceSettledAt
          ? Number(order.balanceAmount ?? 0)
          : 0,
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
    outstandingTotal: Number(outstanding._sum.balanceAmount ?? 0),
    outstandingCount: outstanding._count.id,
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
    // revertOrderStatus: false — the order was just cancelled. Letting the shipment
    // service put it back to CONFIRMED undid the cancellation, and the auto-ship
    // sweeper (CONFIRMED + no non-FAILED shipment) then re-manifested an order the
    // customer had already been refunded for.
    await cancelShipmentService(adminId, orderId, undefined, { revertOrderStatus: false });
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
          // Balance leg — what is outstanding, how it arrived, and what is owed back
          // by hand when a cash-collected balance has to be returned.
          balanceAmount: true, balanceSettledAt: true, balanceMethod: true,
          balancePaidAt: true, balanceReference: true,
          codRemittedAt: true, codRemittedAmount: true,
          manualRefundAmount: true, manualRefundSettledAt: true,
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
      // The "Resolve Return" action addresses the Return, not the Order.
      returns: {
        select: { id: true, status: true, reason: true, refundAmount: true, createdAt: true },
        take: 1,
      },
    },
  });

  if (!order) throw new ApiError(404, OrderErrorCode.ORDER_NOT_FOUND);

  const settled = order.payment?.status === "SUCCESS" || Boolean(order.payment?.balanceSettledAt);

  return {
    ...order,
    // Mirrors the customer payload so the admin panel and the storefront cannot
    // disagree about what is outstanding.
    partial:
      order.paymentPlan === "PARTIAL"
        ? {
            depositAmount: Number(order.depositAmount ?? 0),
            balanceAmount: Number(order.balanceAmount ?? 0),
            depositPaidAt: order.depositPaidAt,
            balancePaidAt: order.payment?.balancePaidAt ?? null,
            balanceStatus: order.depositForfeitedAt
              ? ("WRITTEN_OFF" as const)
              : settled
                ? ("PAID" as const)
                : ("DUE" as const),
            balanceMethod: order.payment?.balanceMethod ?? null,
            balanceReference: order.payment?.balanceReference ?? null,
            collectedAtDoor: Boolean(order.dispatchLockedAt) && !settled,
            depositForfeited: Boolean(order.depositForfeitedAt),
            depositForfeitedAt: order.depositForfeitedAt,
            manualRefundAmount: order.payment?.manualRefundAmount
              ? Number(order.payment.manualRefundAmount)
              : null,
            manualRefundSettledAt: order.payment?.manualRefundSettledAt ?? null,
          }
        : null,
    returnId:     order.returns[0]?.id ?? null,
    returnStatus: order.returns[0]?.status ?? null,
    returns: order.returns.map((r) => ({
      ...r,
      refundAmount: r.refundAmount?.toNumber() ?? null,
    })),
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
  adminId: string,
  /**
   * Who the cancellation is on behalf of. Required when cancelling a partial-payment
   * order, because the two cases have opposite money outcomes and this is the only
   * admin cancel there is:
   *
   *  - MERCHANT — we cannot fulfil. The deposit is returned in full.
   *  - CUSTOMER — cancelled on the customer's behalf. The deposit is forfeited, exactly
   *               as if they had cancelled it themselves.
   *
   * Without it an admin doing a customer a favour would silently refund a deposit that
   * policy says is retained, with no way to tell afterwards which was meant.
   */
  cancellationParty?: "MERCHANT" | "CUSTOMER"
) {
  // Read before the unwind, so the refund policy is decided from the state being cancelled.
  const preState =
    newStatus === OrderStatus.CANCELLED
      ? await prisma.order.findUnique({
          where: { id },
          select: {
            paymentPlan: true,
            payment: { select: { status: true, balanceSettledAt: true } },
          },
        })
      : null;

  const depositAtRisk =
    preState?.paymentPlan === "PARTIAL" && preState.payment?.status === "PARTIALLY_PAID";

  if (depositAtRisk && !cancellationParty) {
    throw new ApiError(400, OrderErrorCode.CANCELLATION_PARTY_REQUIRED);
  }

  // Marking a partial order delivered while its balance is still outstanding would
  // record the goods as handed over with the money unaccounted for, and nothing else
  // would ever prompt for it. Settle it first (Mark Balance Paid) or write it off.
  //
  // Only the admin path is affected: the courier webhook writes DELIVERED directly and
  // settles COD in the same flow, so it never reaches this function.
  if (newStatus === OrderStatus.DELIVERED) {
    const money = await prisma.order.findUnique({
      where: { id },
      select: {
        status: true,
        paymentPlan: true,
        depositForfeitedAt: true,
        payment: { select: { status: true, balanceSettledAt: true } },
      },
    });

    // Only speak about the money when delivering is actually the next legal step.
    // Otherwise an admin attempting an impossible jump would be told the balance is
    // unsettled, which sends them off to chase a payment when the real answer is that
    // the order is not out for delivery yet.
    const transitionAllowed =
      !!money && (statusTransitions[money.status] ?? []).includes(OrderStatus.DELIVERED);

    const outstanding =
      money?.paymentPlan === "PARTIAL" &&
      !money.depositForfeitedAt &&
      money.payment?.status !== "SUCCESS" &&
      !money.payment?.balanceSettledAt;

    if (transitionAllowed && outstanding) {
      throw new ApiError(400, OrderErrorCode.BALANCE_UNSETTLED);
    }
  }

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

    // PROCESSING belongs here too: `statusTransitions` allows PROCESSING → CANCELLED,
    // but this gate only listed PENDING/CONFIRMED — so cancelling a manifested order
    // refunded the customer while silently keeping their stock decremented, their
    // coupon use consumed, a COD payment sitting at PENDING as though money were owed,
    // and the affiliate's commission balance inflated.
    if (
      newStatus === OrderStatus.CANCELLED &&
      (order.status === OrderStatus.PENDING ||
        order.status === OrderStatus.CONFIRMED ||
        order.status === OrderStatus.PROCESSING)
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
  }, {
    // The cancellation unwind is a lot of round-trips — per-item stock updates,
    // stock-flag resync, coupon, payment and the affiliate commission reversal —
    // and it now also runs for PROCESSING orders. Prisma's 5s default is not
    // enough on a remote database: it aborts mid-unwind and rolls the whole
    // cancellation back. Matches the explicit budgets used by refreshService and
    // deleteAccountService.
    maxWait: 5000,
    timeout: 20000,
  });

  // Both of these make their own external/DB calls and so run after the commit.
  let refund: Awaited<ReturnType<typeof refundOrderMoney>> = { status: "none" };

  if (newStatus === OrderStatus.CANCELLED) {
    // A PROCESSING order has already been manifested with Delhivery. Cancelling it
    // in our DB without cancelling the waybill left a live parcel that would still
    // ship — the stock was returned and the customer refunded while the goods went
    // out. Best-effort: a courier that refuses the cancellation must not fail the
    // cancellation itself, so the admin is told to pull it manually instead.
    await cancelWaybillForCancelledOrder(id, adminId);

    // A merchant-side cancellation returns everything: the customer did nothing wrong,
    // so there is nothing to forfeit. A customer-side one follows the deposit policy.
    const scope: RefundScope = !depositAtRisk || cancellationParty === "MERCHANT"
      ? "ALL"
      : preState?.payment?.balanceSettledAt
        ? "BALANCE_ONLY"
        : "NONE";

    refund = await refundOrderMoney(
      id,
      cancellationParty === "CUSTOMER"
        ? "Order cancelled by admin on the customer's behalf"
        : "Order cancelled by admin",
      { scope }
    );
  }

  // Dispatch of a locally-fulfilled order. Delhivery dispatch raises the tax invoice
  // for an outstanding balance (CGST §31(1): the invoice travels with the goods), but a
  // local order never goes through that path, so it would otherwise ship with no
  // invoice at all. Fail-soft, and idempotent — issueInvoiceForOrder returns the
  // existing row if one was already raised.
  if (newStatus === OrderStatus.SHIPPED) {
    const local = await prisma.order.findUnique({
      where: { id },
      select: {
        manualFulfilment: true,
        paymentPlan: true,
        payment: { select: { balanceSettledAt: true } },
      },
    });

    if (local?.manualFulfilment && local.paymentPlan === "PARTIAL" && !local.payment?.balanceSettledAt) {
      void issueInvoiceForOrder(id).catch((err) =>
        console.error(`[invoice] manual dispatch issue failed for order ${id}:`, err)
      );
    }
  }

  if (newStatus === OrderStatus.DELIVERED) {
    // Safe wrapper: the status change has already committed, so a settlement failure
    // must be escalated rather than 500-ing the admin over work that did succeed.
    await settleOnDeliverySafe(id, "admin");
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

/**
 * Switch an order between courier and local (hand) fulfilment.
 *
 * Refused while a live waybill exists: the parcel is physically with Delhivery, and an
 * order claiming to be delivered locally while a courier is carrying it is the one state
 * ops cannot recover from. Cancel the shipment first, which is an explicit action with
 * its own audit trail.
 *
 * Also refused once the order is past dispatch — the fulfilment route is a decision about
 * how the goods travel, and they have already travelled.
 */
export async function setOrderFulfilmentModeService(
  id: string,
  manual: boolean,
  adminId: string,
  req?: Request
) {
  const order = await prisma.order.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      status: true,
      manualFulfilment: true,
      shipments: { select: { id: true, status: true, providerRefId: true } },
    },
  });

  if (!order) throw new ApiError(404, OrderErrorCode.ORDER_NOT_FOUND);
  if (order.manualFulfilment === manual) {
    return { id: order.id, manualFulfilment: manual, changed: false };
  }

  if (!["PENDING", "CONFIRMED", "PROCESSING"].includes(order.status)) {
    throw new ApiError(400, OrderErrorCode.INVALID_STATUS_TRANSITION);
  }

  // FAILED rows are cancelled or unsuccessful attempts, not live parcels — the same
  // rule createShipmentService and the sweeper already use.
  const activeShipment = order.shipments.find(
    (sh) => sh.providerRefId && sh.status !== "FAILED"
  );
  if (activeShipment) {
    throw new ApiError(409, OrderErrorCode.SHIPMENT_ACTIVE);
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { manualFulfilment: manual },
    select: { id: true, manualFulfilment: true },
  });

  void createAuditLog({
    userId: adminId,
    action: "ORDER_FULFILMENT_MODE_CHANGED",
    entity: "Order",
    entityId: id,
    oldValue: { manualFulfilment: order.manualFulfilment },
    newValue: { manualFulfilment: manual },
    req,
  });

  return { ...updated, changed: true };
}
