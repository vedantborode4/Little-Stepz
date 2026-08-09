import crypto from "crypto";
import { prisma } from "@repo/db/client";
import { ApiError } from "../utils/api";
import { syncProductStockFlag } from "../utils/stock";
import { PENDING_ORDER_TTL_MS } from "../utils/pendingRelease";
import { PreOrderErrorCode } from "../utils/preorderErrors";
import { resolveChargedPrice } from "../utils/pricing";
import {
  createRazorpayOrder,
  verifyRazorpaySignature,
  fetchRazorpayPayment,
} from "../utils/razorpay.client";
import {
  sendPreOrderBookedEmail,
  sendBackInStockEmail,
  sendBalancePaidEmail,
} from "../utils/email";
import { Decimal } from "decimal.js";
import type { CreatePreOrderData, VerifyPreOrderPaymentData } from "@repo/zod-schema/index";

const TX_RETRIES = 3;
const FLAT_SHIPPING = new Decimal(5.0);

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let attempts = 0;
  while (attempts < TX_RETRIES) {
    try {
      return await fn();
    } catch (err: any) {
      const retryable =
        err?.code === "P2034" ||
        err?.message?.includes("serialization failure") ||
        err?.message?.includes("could not serialize") ||
        err?.message?.includes("Transaction failed");
      if (retryable && attempts < TX_RETRIES - 1) {
        attempts++;
        await new Promise((r) => setTimeout(r, Math.pow(2, attempts) * 100 + Math.random() * 100));
        continue;
      }
      throw err;
    }
  }
  throw new ApiError(500, PreOrderErrorCode.CONCURRENCY_CONFLICT);
}

const balanceDays = () => Number(process.env.PREORDER_BALANCE_DAYS ?? "7");

const preOrderSelect = {
  id: true,
  status: true,
  quantity: true,
  unitPrice: true,
  bookingAmount: true,
  shippingCharges: true,
  totalAmount: true,
  balanceAmount: true,
  balanceDueAt: true,
  notifiedAt: true,
  bookingPaidAt: true,
  balancePaidAt: true,
  orderId: true,
  createdAt: true,
  product: { select: { id: true, name: true, slug: true, images: { where: { variantId: null, deletedAt: null }, take: 1, select: { url: true } } } },
  variant: { select: { id: true, name: true } },
} as const;

/* ───────────────────────── Booking ───────────────────────── */

export async function createPreOrderService(
  userId: string,
  data: CreatePreOrderData,
  idempotencyKey: string
) {
  return withRetry(async () => {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.preOrder.findUnique({ where: { idempotencyKey } });
      if (existing) {
        if (existing.userId !== userId) throw new ApiError(403, PreOrderErrorCode.UNAUTHORIZED_ACCESS);
        return { preOrder: existing, reused: true };
      }

      const address = await tx.address.findFirst({
        where: { id: data.addressId, userId, deletedAt: null },
      });
      if (!address) throw new ApiError(400, PreOrderErrorCode.INVALID_ADDRESS);

      const product = await tx.product.findFirst({
        where: { id: data.productId, deletedAt: null },
        select: {
          id: true, price: true, salePrice: true, isOnSale: true,
          quantity: true, inStock: true,
          preOrderEnabled: true, bookingAmount: true, preOrderLimit: true, preOrderCount: true,
        },
      });
      if (!product) throw new ApiError(404, PreOrderErrorCode.PRODUCT_NOT_FOUND);
      if (!product.preOrderEnabled || product.bookingAmount == null) {
        throw new ApiError(400, PreOrderErrorCode.PREORDER_NOT_ENABLED);
      }

      let variant: { id: string; price: Decimal | null; salePrice: Decimal | null; isOnSale: boolean; stock: number } | null = null;
      if (data.variantId) {
        variant = await tx.variant.findFirst({
          where: { id: data.variantId, productId: product.id, deletedAt: null },
          select: { id: true, price: true, salePrice: true, isOnSale: true, stock: true },
        });
        if (!variant) throw new ApiError(400, PreOrderErrorCode.VARIANT_INVALID);
      }

      // Pre-orders are only for currently-unavailable items.
      const available = variant ? variant.stock > 0 : product.inStock && product.quantity > 0;
      if (available) throw new ApiError(400, PreOrderErrorCode.PRODUCT_AVAILABLE);

      // Pricing snapshot (uses the actually-charged price, sale-aware).
      const unitPrice = resolveChargedPrice(product as any, variant as any);
      const shipping = FLAT_SHIPPING;
      const total = unitPrice.mul(data.quantity).add(shipping).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
      const booking = new Decimal(product.bookingAmount.toString()).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
      // Guard: a booking can never meet/exceed the order total (would make the balance ≤ 0).
      if (booking.gte(total)) throw new ApiError(400, PreOrderErrorCode.BOOKING_EXCEEDS_TOTAL);
      const balance = Decimal.max(total.sub(booking), new Decimal(0)).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);

      // Reclaim abandoned (never-paid) bookings so they don't hold cap slots. Same
      // window as orders; stockSweeper.services.ts sweeps these on a timer too, so
      // this is opportunistic rather than the only release path.
      const staleBefore = new Date(Date.now() - PENDING_ORDER_TTL_MS);
      const stale = await tx.preOrder.findMany({
        where: { productId: product.id, status: "PENDING_BOOKING", createdAt: { lt: staleBefore } },
        select: { id: true, quantity: true },
      });
      if (stale.length) {
        const reclaimQty = stale.reduce((s, p) => s + p.quantity, 0);
        await tx.preOrder.updateMany({ where: { id: { in: stale.map((s) => s.id) } }, data: { status: "CANCELLED" } });
        await tx.product.update({ where: { id: product.id }, data: { preOrderCount: { decrement: reclaimQty } } });
      }

      // Atomic cap guard (constant threshold computed from the just-read limit; WHERE sees reclaimed count).
      if (product.preOrderLimit != null) {
        const upd = await tx.product.updateMany({
          where: { id: product.id, preOrderCount: { lte: product.preOrderLimit - data.quantity } },
          data: { preOrderCount: { increment: data.quantity } },
        });
        if (upd.count === 0) throw new ApiError(400, PreOrderErrorCode.PREORDER_FULL);
      } else {
        await tx.product.update({
          where: { id: product.id },
          data: { preOrderCount: { increment: data.quantity } },
        });
      }

      const preOrder = await tx.preOrder.create({
        data: {
          userId,
          productId: product.id,
          variantId: variant?.id ?? null,
          quantity: data.quantity,
          addressId: data.addressId,
          unitPrice,
          bookingAmount: booking,
          shippingCharges: shipping,
          totalAmount: total,
          balanceAmount: balance,
          status: "PENDING_BOOKING",
          idempotencyKey,
        },
      });

      return { preOrder, reused: false };
    });

    const { preOrder } = result;

    // Reuse an existing Razorpay booking order if present (idempotent retries).
    if (preOrder.bookingRazorpayOrderId && preOrder.status === "PENDING_BOOKING") {
      return {
        preOrderId: preOrder.id,
        razorpayOrderId: preOrder.bookingRazorpayOrderId,
        amount: Number(preOrder.bookingAmount),
        currency: "INR",
        keyId: process.env.RAZORPAY_KEY_ID,
      };
    }

    if (preOrder.status !== "PENDING_BOOKING") {
      // Already booked — nothing to pay again.
      throw new ApiError(409, PreOrderErrorCode.INVALID_STATE);
    }

    let rzp;
    try {
      rzp = await createRazorpayOrder({
        amount: Number(preOrder.bookingAmount),
        currency: "INR",
        receipt: preOrder.id.substring(0, 40),
        notes: { preOrderId: preOrder.id, leg: "booking", userId },
      });
    } catch {
      throw new ApiError(502, PreOrderErrorCode.RAZORPAY_ORDER_CREATE_FAILED);
    }

    await prisma.preOrder.update({
      where: { id: preOrder.id },
      data: { bookingRazorpayOrderId: rzp.id },
    });

    return {
      preOrderId: preOrder.id,
      razorpayOrderId: rzp.id,
      amount: Number(preOrder.bookingAmount),
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
    };
  });
}

/** Idempotent — used by the verify endpoint and the webhook backup. */
export async function confirmBookingPaid(
  preOrderId: string,
  args: { razorpayPaymentId: string; gatewayResponse?: any }
) {
  await withRetry(async () => {
    await prisma.$transaction(async (tx) => {
      const po = await tx.preOrder.findUnique({
        where: { id: preOrderId },
        include: { user: { select: { email: true } }, product: { select: { name: true } } },
      });
      if (!po) throw new ApiError(404, PreOrderErrorCode.PREORDER_NOT_FOUND);
      if (po.status !== "PENDING_BOOKING") return; // already booked / advanced

      await tx.preOrder.update({
        where: { id: po.id },
        data: {
          status: "BOOKED",
          bookingPaidAt: new Date(),
          bookingRazorpayPaymentId: args.razorpayPaymentId,
        },
      });

      // Fire-and-forget email after commit
      void sendPreOrderBookedEmail(po.user.email, {
        productName: po.product.name,
        bookingAmount: Number(po.bookingAmount),
        balanceAmount: Number(po.balanceAmount),
      });
    });
  });
}

export async function verifyBookingPaymentService(
  userId: string,
  preOrderId: string,
  data: VerifyPreOrderPaymentData
) {
  const po = await prisma.preOrder.findUnique({
    where: { id: preOrderId },
    select: { id: true, userId: true, status: true, bookingRazorpayOrderId: true, bookingAmount: true },
  });
  if (!po) throw new ApiError(404, PreOrderErrorCode.PREORDER_NOT_FOUND);
  if (po.userId !== userId) throw new ApiError(403, PreOrderErrorCode.UNAUTHORIZED_ACCESS);
  if (po.status !== "PENDING_BOOKING") return { success: true, alreadyProcessed: true };

  if (po.bookingRazorpayOrderId !== data.razorpayOrderId) {
    throw new ApiError(400, PreOrderErrorCode.RAZORPAY_ORDER_ID_MISMATCH);
  }

  let ok = false;
  try {
    ok = verifyRazorpaySignature({
      razorpayOrderId: data.razorpayOrderId,
      razorpayPaymentId: data.razorpayPaymentId,
      razorpaySignature: data.razorpaySignature,
    });
  } catch { ok = false; }
  if (!ok) throw new ApiError(400, PreOrderErrorCode.INVALID_SIGNATURE);

  const rp = await fetchRazorpayPayment(data.razorpayPaymentId).catch(() => null);
  if (!rp || rp.order_id !== data.razorpayOrderId) {
    throw new ApiError(400, PreOrderErrorCode.RAZORPAY_ORDER_ID_MISMATCH);
  }
  if (rp.amount !== Math.round(Number(po.bookingAmount) * 100)) {
    throw new ApiError(400, PreOrderErrorCode.AMOUNT_MISMATCH);
  }

  await confirmBookingPaid(po.id, { razorpayPaymentId: data.razorpayPaymentId, gatewayResponse: rp });
  return { success: true, alreadyProcessed: false };
}

/* ───────────────────────── Customer reads ───────────────────────── */

export async function getMyPreOrdersService(userId: string) {
  const items = await prisma.preOrder.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { ...preOrderSelect, balanceToken: true },
  });
  return { preOrders: items };
}

export async function getPreOrderByIdService(userId: string, id: string) {
  const po = await prisma.preOrder.findFirst({
    where: { id, userId, deletedAt: null },
    select: { ...preOrderSelect, balanceToken: true },
  });
  if (!po) throw new ApiError(404, PreOrderErrorCode.PREORDER_NOT_FOUND);
  return po;
}

/* ───────────────────────── Balance (token-gated) ───────────────────────── */

async function expireIfOverdue(po: { id: string; status: string; balanceDueAt: Date | null; quantity: number; productId: string }) {
  if (po.status === "AWAITING_BALANCE" && po.balanceDueAt && po.balanceDueAt.getTime() < Date.now()) {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.preOrder.findUnique({ where: { id: po.id }, select: { status: true } });
      if (fresh?.status !== "AWAITING_BALANCE") return;
      await tx.preOrder.update({ where: { id: po.id }, data: { status: "EXPIRED" } });
      await tx.product.update({ where: { id: po.productId }, data: { preOrderCount: { decrement: po.quantity } } });
    });
    return "EXPIRED" as const;
  }
  return po.status;
}

export async function getPreOrderByTokenService(token: string) {
  const po = await prisma.preOrder.findUnique({
    where: { balanceToken: token },
    select: { ...preOrderSelect, productId: true },
  });
  if (!po) throw new ApiError(404, PreOrderErrorCode.PREORDER_NOT_FOUND);
  const status = await expireIfOverdue(po);
  return { ...po, status };
}

export async function createBalancePaymentService(token: string) {
  const po = await prisma.preOrder.findUnique({
    where: { balanceToken: token },
    select: { id: true, status: true, balanceAmount: true, balanceDueAt: true, balanceRazorpayOrderId: true, quantity: true, productId: true },
  });
  if (!po) throw new ApiError(404, PreOrderErrorCode.PREORDER_NOT_FOUND);
  const status = await expireIfOverdue(po);
  if (status !== "AWAITING_BALANCE") throw new ApiError(400, status === "EXPIRED" ? PreOrderErrorCode.LINK_EXPIRED : PreOrderErrorCode.INVALID_STATE);

  if (po.balanceRazorpayOrderId) {
    return {
      razorpayOrderId: po.balanceRazorpayOrderId,
      amount: Number(po.balanceAmount),
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
    };
  }

  let rzp;
  try {
    rzp = await createRazorpayOrder({
      amount: Number(po.balanceAmount),
      currency: "INR",
      receipt: po.id.substring(0, 40),
      notes: { preOrderId: po.id, leg: "balance" },
    });
  } catch {
    throw new ApiError(502, PreOrderErrorCode.RAZORPAY_ORDER_CREATE_FAILED);
  }

  await prisma.preOrder.update({ where: { id: po.id }, data: { balanceRazorpayOrderId: rzp.id } });

  return { razorpayOrderId: rzp.id, amount: Number(po.balanceAmount), currency: "INR", keyId: process.env.RAZORPAY_KEY_ID };
}

/** Idempotent — used by the verify endpoint and the webhook backup. Creates the real Order. */
export async function completePreOrderBalance(
  preOrderId: string,
  args: { razorpayPaymentId: string; razorpayOrderId: string; gatewayResponse?: any }
): Promise<{ orderId: string; alreadyProcessed: boolean }> {
  return withRetry(async () => {
    return prisma.$transaction(async (tx) => {
      const po = await tx.preOrder.findUnique({
        where: { id: preOrderId },
        include: { user: { select: { email: true } }, product: { select: { name: true } } },
      });
      if (!po) throw new ApiError(404, PreOrderErrorCode.PREORDER_NOT_FOUND);
      if (po.status === "COMPLETED" && po.orderId) {
        return { orderId: po.orderId, alreadyProcessed: true };
      }
      if (po.status !== "AWAITING_BALANCE") throw new ApiError(400, PreOrderErrorCode.INVALID_STATE);
      if (!po.addressId) throw new ApiError(400, PreOrderErrorCode.INVALID_ADDRESS);

      // Atomic stock claim — first balance payment wins.
      const claimed = po.variantId
        ? await tx.variant.updateMany({
            where: { id: po.variantId, stock: { gte: po.quantity } },
            data: { stock: { decrement: po.quantity } },
          })
        : await tx.product.updateMany({
            where: { id: po.productId, quantity: { gte: po.quantity } },
            data: { quantity: { decrement: po.quantity } },
          });
      if (claimed.count === 0) throw new ApiError(409, PreOrderErrorCode.OUT_OF_STOCK_AGAIN);

      // Converting a pre-order consumes real stock, so the flag must follow it.
      await syncProductStockFlag(tx, po.productId);

      const order = await tx.order.create({
        data: {
          userId: po.userId,
          addressId: po.addressId,
          subtotal: po.unitPrice.mul(po.quantity),
          discount: new Decimal(0),
          shippingCharges: po.shippingCharges,
          total: po.totalAmount,
          status: "CONFIRMED",
          paymentMethod: "ONLINE",
          idempotencyKey: `preorder-${po.id}`,
        },
      });

      await tx.orderItem.create({
        data: {
          orderId: order.id,
          productId: po.productId,
          variantId: po.variantId,
          quantity: po.quantity,
          price: po.unitPrice,
        },
      });

      await tx.payment.create({
        data: {
          orderId: order.id,
          method: "ONLINE",
          gateway: "razorpay",
          razorpayOrderId: args.razorpayOrderId,
          razorpayPaymentId: args.razorpayPaymentId,
          // This Razorpay payment captured only the balance leg; the booking was a
          // separate charge tracked on the PreOrder. Recording the true captured
          // amount keeps refunds/webhook amount-checks correct.
          amount: po.balanceAmount,
          currency: "INR",
          status: "SUCCESS",
          attempts: 1,
          gatewayResponse: args.gatewayResponse ?? undefined,
        },
      });

      await tx.preOrder.update({
        where: { id: po.id },
        data: {
          status: "COMPLETED",
          balancePaidAt: new Date(),
          balanceRazorpayPaymentId: args.razorpayPaymentId,
          orderId: order.id,
        },
      });

      // free the reservation slot
      await tx.product.update({ where: { id: po.productId }, data: { preOrderCount: { decrement: po.quantity } } });

      void sendBalancePaidEmail(po.user.email, { productName: po.product.name, orderId: order.id });

      return { orderId: order.id, alreadyProcessed: false };
    });
  });
}

export async function verifyBalancePaymentService(token: string, data: VerifyPreOrderPaymentData) {
  const po = await prisma.preOrder.findUnique({
    where: { balanceToken: token },
    select: { id: true, status: true, balanceRazorpayOrderId: true, balanceAmount: true, balanceDueAt: true, quantity: true, productId: true },
  });
  if (!po) throw new ApiError(404, PreOrderErrorCode.PREORDER_NOT_FOUND);
  if (po.status === "COMPLETED") return { success: true, alreadyProcessed: true };

  const status = await expireIfOverdue(po);
  if (status !== "AWAITING_BALANCE") throw new ApiError(400, status === "EXPIRED" ? PreOrderErrorCode.LINK_EXPIRED : PreOrderErrorCode.INVALID_STATE);

  if (po.balanceRazorpayOrderId !== data.razorpayOrderId) {
    throw new ApiError(400, PreOrderErrorCode.RAZORPAY_ORDER_ID_MISMATCH);
  }

  let ok = false;
  try {
    ok = verifyRazorpaySignature({
      razorpayOrderId: data.razorpayOrderId,
      razorpayPaymentId: data.razorpayPaymentId,
      razorpaySignature: data.razorpaySignature,
    });
  } catch { ok = false; }
  if (!ok) throw new ApiError(400, PreOrderErrorCode.INVALID_SIGNATURE);

  const rp = await fetchRazorpayPayment(data.razorpayPaymentId).catch(() => null);
  if (!rp || rp.order_id !== data.razorpayOrderId) {
    throw new ApiError(400, PreOrderErrorCode.RAZORPAY_ORDER_ID_MISMATCH);
  }
  if (rp.amount !== Math.round(Number(po.balanceAmount) * 100)) {
    throw new ApiError(400, PreOrderErrorCode.AMOUNT_MISMATCH);
  }

  const res = await completePreOrderBalance(po.id, {
    razorpayPaymentId: data.razorpayPaymentId,
    razorpayOrderId: data.razorpayOrderId,
    gatewayResponse: rp,
  });
  return { success: true, orderId: res.orderId, alreadyProcessed: res.alreadyProcessed };
}

/* ───────────────────────── Restock notification (event-driven) ───────────────────────── */

export async function notifyRestockedPreOrders(productId: string, variantId?: string | null) {
  try {
    const due = new Date(Date.now() + balanceDays() * 24 * 60 * 60 * 1000);
    const pending = await prisma.preOrder.findMany({
      where: {
        productId,
        ...(variantId ? { variantId } : {}),
        status: "BOOKED",
        deletedAt: null,
      },
      include: { user: { select: { email: true } }, product: { select: { name: true } } },
    });

    for (const po of pending) {
      const token = crypto.randomBytes(24).toString("hex");
      await prisma.preOrder.update({
        where: { id: po.id },
        data: { status: "AWAITING_BALANCE", balanceToken: token, balanceDueAt: due, notifiedAt: new Date() },
      });
      const payUrl = `${process.env.FRONTEND_URL ?? ""}/pre-orders/pay/${token}`;
      void sendBackInStockEmail(po.user.email, {
        productName: po.product.name,
        balanceAmount: Number(po.balanceAmount),
        payUrl,
        dueDate: due,
      });
    }
    return pending.length;
  } catch (err) {
    console.error("[preorder] notifyRestockedPreOrders failed:", err);
    return 0;
  }
}

/** Webhook backup reconciliation — given a Razorpay order id, advance the matching pre-order leg. */
export async function reconcilePreOrderByRazorpayOrderId(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  gatewayResponse?: any
): Promise<boolean> {
  const booking = await prisma.preOrder.findUnique({ where: { bookingRazorpayOrderId: razorpayOrderId }, select: { id: true } });
  if (booking) {
    await confirmBookingPaid(booking.id, { razorpayPaymentId, gatewayResponse });
    return true;
  }
  const balance = await prisma.preOrder.findUnique({ where: { balanceRazorpayOrderId: razorpayOrderId }, select: { id: true } });
  if (balance) {
    await completePreOrderBalance(balance.id, { razorpayPaymentId, razorpayOrderId, gatewayResponse });
    return true;
  }
  return false;
}
