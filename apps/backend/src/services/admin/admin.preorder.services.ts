import crypto from "crypto";
import { prisma, PreOrderStatus } from "@repo/db/client";
import { ApiError } from "../../utils/api";
import { PreOrderErrorCode } from "../../utils/preorderErrors";
import { initiateRazorpayRefund } from "../../utils/razorpay.client";
import { sendBackInStockEmail } from "../../utils/email";
import { releasePreOrderSlots } from "../../utils/preOrderTerms";
import { createAuditLog } from "../../utils/auditLog";
import { notifyAdmins } from "../notification.services";
import { money } from "../../utils/notificationCopy";

const ACTIVE: PreOrderStatus[] = ["PENDING_BOOKING", "BOOKED", "AWAITING_BALANCE"];

const adminSelect = {
  id: true,
  status: true,
  quantity: true,
  unitPrice: true,
  bookingAmount: true,
  totalAmount: true,
  balanceAmount: true,
  bookingPaidAt: true,
  balancePaidAt: true,
  balanceDueAt: true,
  notifiedAt: true,
  refundedAt: true,
  orderId: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true } },
  product: { select: { id: true, name: true, slug: true } },
  variant: { select: { id: true, name: true } },
} as const;

export async function listPreOrdersService(page: number, limit: number, status?: PreOrderStatus) {
  const skip = (page - 1) * limit;
  const where: any = { deletedAt: null };
  if (status) where.status = status;

  const [preOrders, total] = await Promise.all([
    prisma.preOrder.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" }, select: adminSelect }),
    prisma.preOrder.count({ where }),
  ]);

  // Expiry is enforced lazily (on the customer pay-link). Reflect it in the admin list
  // so overdue rows don't keep showing AWAITING_BALANCE until a customer happens to open the link.
  const now = Date.now();
  const display = preOrders.map((p) =>
    p.status === "AWAITING_BALANCE" && p.balanceDueAt && p.balanceDueAt.getTime() < now
      ? { ...p, status: "EXPIRED" as const }
      : p
  );

  return { preOrders: display, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getAdminPreOrderByIdService(id: string) {
  const po = await prisma.preOrder.findFirst({
    where: { id, deletedAt: null },
    select: {
      ...adminSelect,
      bookingRazorpayPaymentId: true,
      balanceRazorpayPaymentId: true,
      refundId: true,
      address: { select: { name: true, phone: true, address: true, city: true, state: true, pincode: true } },
    },
  });
  if (!po) throw new ApiError(404, PreOrderErrorCode.PREORDER_NOT_FOUND);
  return po;
}

export async function refundBookingService(id: string) {
  const po = await prisma.preOrder.findFirst({ where: { id, deletedAt: null } });
  if (!po) throw new ApiError(404, PreOrderErrorCode.PREORDER_NOT_FOUND);
  if (po.status === "REFUNDED") throw new ApiError(400, PreOrderErrorCode.INVALID_STATE);
  // A completed pre-order is a real paid order — its money must be returned via the
  // normal order-refund flow, not by refunding the booking leg here.
  if (po.status === "COMPLETED") {
    throw new ApiError(400, "Cannot refund a completed pre-order's booking; refund the order instead");
  }
  if (!po.bookingRazorpayPaymentId) throw new ApiError(400, "No booking payment to refund");

  // Atomically claim the refund so two concurrent clicks can't double-refund.
  const claim = await prisma.preOrder.updateMany({
    where: { id, status: { notIn: ["REFUNDED", "COMPLETED"] } },
    data: { status: "REFUNDED", refundedAt: new Date() },
  });
  if (claim.count === 0) throw new ApiError(400, PreOrderErrorCode.INVALID_STATE);

  let refund;
  try {
    refund = await initiateRazorpayRefund({
      paymentId: po.bookingRazorpayPaymentId,
      amount: Number(po.bookingAmount),
      notes: { preOrderId: po.id, reason: "pre-order booking refund" },
    });
  } catch (e: any) {
    // The claim is deliberately NOT rolled back.
    //
    // This used to reset the status so an admin could retry, but Razorpay refunds are not
    // idempotent: when the failure is only a lost response — the common case — the refund
    // did go through, and a retry pays the customer twice. Every other refund path in this
    // codebase (`refundOrderMoney`, `handleRefundFailed`) leaves the claim standing for
    // exactly this reason, and having one path disagree meant the safe answer depended on
    // which button the admin happened to press.
    //
    // A human reconciles from the audit row instead.
    await createAuditLog({
      action: "REFUND_FAILED",
      entity: "Payment",
      entityId: po.id,
      newValue: {
        amount: Number(po.bookingAmount),
        leg: "booking",
        reason: "pre-order booking refund",
        error: String(e?.message ?? e).slice(0, 300),
      },
    });

    void notifyAdmins({
      type: "ADMIN_CUSTOM",
      title: "Manual refund needed ⚠️",
      body: `The booking refund of ${money(Number(po.bookingAmount))} for pre-order #${po.id.slice(
        0,
        8
      )} failed at the gateway. Check Razorpay before retrying — the refund may already have gone through.`,
      data: { screen: "AdminPreOrders", preOrderId: po.id },
    });

    throw e;
  }

  await prisma.$transaction(async (tx) => {
    await tx.preOrder.update({ where: { id }, data: { refundId: refund.id } });
    if (ACTIVE.includes(po.status)) {
      await releasePreOrderSlots(tx, [{ productId: po.productId, variantId: po.variantId, quantity: po.quantity }]);
    }
  });

  return { refunded: true, refundId: refund.id };
}

export async function cancelPreOrderService(id: string) {
  const po = await prisma.preOrder.findFirst({ where: { id, deletedAt: null } });
  if (!po) throw new ApiError(404, PreOrderErrorCode.PREORDER_NOT_FOUND);
  if (po.status === "COMPLETED") throw new ApiError(400, PreOrderErrorCode.INVALID_STATE);

  await prisma.$transaction(async (tx) => {
    await tx.preOrder.update({ where: { id: po.id }, data: { status: "CANCELLED" } });
    if (ACTIVE.includes(po.status)) {
      await releasePreOrderSlots(tx, [{ productId: po.productId, variantId: po.variantId, quantity: po.quantity }]);
    }
  });

  return { cancelled: true };
}

export async function resendBalanceLinkService(id: string) {
  const po = await prisma.preOrder.findFirst({
    where: { id, deletedAt: null },
    include: { user: { select: { email: true } }, product: { select: { name: true } } },
  });
  if (!po) throw new ApiError(404, PreOrderErrorCode.PREORDER_NOT_FOUND);
  if (po.status !== "AWAITING_BALANCE") throw new ApiError(400, PreOrderErrorCode.INVALID_STATE);

  const days = Number(process.env.PREORDER_BALANCE_DAYS ?? "7");
  const due = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const token = crypto.randomBytes(24).toString("hex");

  await prisma.preOrder.update({
    where: { id: po.id },
    data: { balanceToken: token, balanceDueAt: due, notifiedAt: new Date() },
  });

  const payUrl = `${process.env.FRONTEND_URL ?? ""}/pre-orders/pay/${token}`;
  await sendBackInStockEmail(po.user.email, {
    productName: po.product.name,
    balanceAmount: Number(po.balanceAmount),
    payUrl,
    dueDate: due,
  });

  return { sent: true };
}
