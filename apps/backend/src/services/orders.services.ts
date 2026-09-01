import { prisma, OrderStatus } from '@repo/db/client';
import { ApiError } from '../utils/api';
import { OrderErrorCode } from '../utils/orderErrors';
import { resolveChargedPrice } from '../utils/pricing';
import { Decimal } from 'decimal.js';
import type { CreateOrderBody } from '@repo/zod-schema/index';
import { validateCouponService } from './coupons.services';
import { assertServiceable, assertCodCollectable, resolveShippingCharge } from '../utils/shipping';
import {
  isPartialPaymentEnabled,
  resolveCartPartialTerms,
  splitDeposit,
  isPartialSplittable,
  maxPartialOrderValue,
  maxOpenPartialOrders,
} from '../utils/partialPayment';
import { notify } from './notification.services';
import { orderShortRef, money } from '../utils/notificationCopy';
import { syncProductStockFlag, syncProductStockFlags } from '../utils/stock';
import { releasePendingOrderStock, stalePendingOrderWhere } from '../utils/pendingRelease';
import { assertPhoneVerified } from "./phoneVerification.services";
import { refundOrderMoney, type RefundScope } from './refund.services';
import { reverseAffiliateCommissionsService } from './affiliate.services';

const MAX_TX_RETRIES = 3;

async function runWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  let attempts = 0;
  while (attempts < MAX_TX_RETRIES) {
    try {
      return await fn();
    } catch (err: any) {
      if (err.message.includes('serialization failure') || err.message.includes('Transaction failed')) { 
        attempts++;
        const backoff = Math.pow(2, attempts) * 100 + Math.random() * 100; 
        await new Promise(resolve => setTimeout(resolve, backoff));
      } else {
        throw err;
      }
    }
  }
  throw new ApiError(500, OrderErrorCode.CONCURRENCY_CONFLICT, {value:['Transaction failed after retries']});
}

const MAX_CART_ITEMS = 100;

type OrderTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Reclaim never-paid PENDING orders that still hold stock for any of `productIds`.
 *
 * This runs opportunistically inside the next order-creation transaction, so a
 * shopper never reads availability that an abandoned checkout is sitting on. It is
 * NOT the safety net — being scoped to `productIds`, it can only fire when someone
 * orders the same product. `stockSweeper.services.ts` is what guarantees release.
 */
async function reclaimStalePendingOrders(tx: OrderTx, productIds: string[]) {
  const stale = await tx.order.findMany({
    where: {
      ...stalePendingOrderWhere(),
      items: { some: { productId: { in: productIds } } },
    },
    select: { id: true },
    take: 50,
  });

  for (const order of stale) {
    await releasePendingOrderStock(tx, order.id);
  }
}

export async function createOrderService(userId: string, data: CreateOrderBody, idempotencyKey: string, affiliateId?: string) {
  // Idempotent replay — return the existing order without a serviceability/shipping lookup.
  const replay = await prisma.order.findUnique({ where: { idempotencyKey } });
  if (replay) {
    if (replay.userId !== userId) throw new ApiError(403, OrderErrorCode.UNAUTHORIZED_ACCESS);
    return {
      orderId: replay.id,
      subtotal: replay.subtotal.toNumber(),
      discount: replay.discount.toNumber(),
      shippingCharges: replay.shippingCharges.toNumber(),
      total: replay.total.toNumber(),
      paymentPlan: replay.paymentPlan,
      amountDueNow: (replay.depositAmount ?? replay.total).toNumber(),
      balanceDue: replay.balanceAmount?.toNumber() ?? 0,
    };
  }

  // Serviceability check + live shipping rate run OUTSIDE the transaction (external HTTP must
  // not hold a DB transaction open). Hard-blocks non-serviceable pincodes.
  const shippingAddress = await prisma.address.findFirst({
    where: { id: data.addressId, userId, deletedAt: null },
  });
  if (!shippingAddress) throw new ApiError(400, OrderErrorCode.INVALID_ADDRESS);

  const wantsPartial = data.paymentPlan === "PARTIAL";
  if (wantsPartial && !isPartialPaymentEnabled()) {
    throw new ApiError(400, OrderErrorCode.PARTIAL_PAYMENT_DISABLED);
  }

  if (wantsPartial) {
    // The balance is collected by the courier, so the pincode must accept COD. This
    // fails CLOSED, unlike `assertServiceable` — taking a deposit for an address where
    // the remaining balance can never be collected is the one outcome worth blocking
    // checkout over.
    await assertCodCollectable(shippingAddress.pincode);
  } else {
    await assertServiceable(shippingAddress.pincode, data.paymentMethod);
  }

  // Off by default, and it must stay that way until the base has converted: every
  // address that predates phone verification has an unverified number, so enabling
  // this blocks checkout for the entire existing customer base. New and edited
  // addresses go through OTP at save time, so the base converts on its own.
  //
  // Partial payment bypasses that flag deliberately. It is opt-in and brand new, so it
  // has no legacy base to strand, and a contactable number is what makes doorstep
  // collection work at all.
  if (wantsPartial || process.env.REQUIRE_VERIFIED_PHONE_AT_CHECKOUT === "true") {
    await assertPhoneVerified(userId, shippingAddress.phone);
  }

  // Quote the rate for how the parcel will actually travel: a COD manifest carries a
  // collection fee. Dormant while FREE_SHIPPING is on, but wired now so the charge does
  // not silently change the day it is turned off.
  const precomputedShipping = await resolveShippingCharge(
    shippingAddress.pincode,
    wantsPartial ? "COD" : data.paymentMethod
  );

  const result = await runWithRetry(async () => {
    return await prisma.$transaction(async (tx) => {

      const existingOrder = await tx.order.findUnique({
        where: { idempotencyKey },
      });
      if (existingOrder) {
        if (existingOrder.userId !== userId) throw new ApiError(403, OrderErrorCode.UNAUTHORIZED_ACCESS);
        // Idempotent return
        return {
          orderId: existingOrder.id,
          subtotal: existingOrder.subtotal.toNumber(),
          discount: existingOrder.discount.toNumber(),
          shippingCharges: existingOrder.shippingCharges.toNumber(),
          total: existingOrder.total.toNumber(),
          paymentPlan: existingOrder.paymentPlan,
          amountDueNow: (existingOrder.depositAmount ?? existingOrder.total).toNumber(),
          balanceDue: existingOrder.balanceAmount?.toNumber() ?? 0,
          isNew: false,
        };
      }

      const address = await tx.address.findFirst({
        where: { id: data.addressId, userId, deletedAt: null },
      });
      if (!address) throw new ApiError(400, OrderErrorCode.INVALID_ADDRESS);

      if (data.cartItems.length === 0) throw new ApiError(400, OrderErrorCode.CART_EMPTY);
      if (data.cartItems.length > MAX_CART_ITEMS) throw new ApiError(400, 'Cart too large');

      let subtotal = new Decimal(0);
      const orderItems: any[] = []; 
      
      const productIds = data.cartItems.map(item => item.productId);
      const variantIds = data.cartItems.filter(item => item.variantId).map(item => item.variantId!);

      // Free stock held by other shoppers' abandoned, never-paid checkouts before
      // reading availability for this one.
      await reclaimStalePendingOrders(tx, productIds);

      const products = await tx.product.findMany({
        where: { id: { in: productIds }, deletedAt: null },
        select: {
          id: true, name: true, price: true, salePrice: true, isOnSale: true,
          quantity: true, inStock: true,
          partialPaymentEnabled: true, depositPercent: true,
        },
      });

      const variants = await tx.variant.findMany({
        where: { id: { in: variantIds }, deletedAt: null },
        select: {
          id: true, name: true, price: true, salePrice: true, isOnSale: true,
          stock: true, productId: true,
          partialPaymentEnabled: true, depositPercent: true,
        },
      });

      const productMap = new Map(products.map(p => [p.id, p]));
      const variantMap = new Map(variants.map(v => [v.id, v]));

      // Partial-payment terms for the whole cart. The order is one payment, so the option
      // stands only if every line allows it; the products and variants are already loaded,
      // so this costs no extra queries.
      const partialTerms = resolveCartPartialTerms(
        data.cartItems.map((item) => ({
          product: productMap.get(item.productId) ?? { partialPaymentEnabled: false, depositPercent: null },
          variant: item.variantId ? variantMap.get(item.variantId) ?? null : null,
        }))
      );
      if (wantsPartial && !partialTerms.enabled) {
        throw new ApiError(400, OrderErrorCode.PARTIAL_NOT_ELIGIBLE);
      }

      if (wantsPartial) {
        // Cap on concurrent unpaid balances. A bare count() is a check-then-write gap
        // under READ COMMITTED — two simultaneous checkouts would both pass a cap of 1 —
        // so the user row is locked first. This serialises only one customer's own
        // concurrent checkouts, which is already pathological.
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;

        const openBalances = await tx.order.count({
          where: {
            userId,
            paymentPlan: "PARTIAL",
            deletedAt: null,
            // Only orders where a deposit actually landed and the balance is still out.
            depositPaidAt: { not: null },
            payment: { status: "PARTIALLY_PAID" },
          },
        });
        if (openBalances >= maxOpenPartialOrders()) {
          throw new ApiError(400, OrderErrorCode.PARTIAL_LIMIT_REACHED);
        }
      }

      for (const item of data.cartItems) {
        const product = productMap.get(item.productId);
        if (!product || !product.inStock) throw new ApiError(400, OrderErrorCode.PRODUCT_DELETED);

        let price: Decimal;
        let stock: number;
        let variantId = item.variantId;
        let variantName: string | null = null;

        if (variantId) {
          const variant = variantMap.get(variantId);
          if (!variant || variant.productId !== item.productId) throw new ApiError(400, OrderErrorCode.VARIANT_DELETED);
          price = resolveChargedPrice(product, variant);
          stock = variant.stock;
          variantName = variant.name;
        } else {
          price = resolveChargedPrice(product);
          stock = product.quantity;
        }

        if (item.quantity <= 0 || item.quantity > stock) throw new ApiError(400, OrderErrorCode.STOCK_INSUFFICIENT);

        const updatedCount = variantId 
          ? await tx.variant.updateMany({
              where: { id: variantId, stock: { gte: item.quantity } },
              data: { stock: { decrement: item.quantity } },
            })
          : await tx.product.updateMany({
              where: { id: item.productId, quantity: { gte: item.quantity } },
              data: { quantity: { decrement: item.quantity } },
            });

        if (updatedCount.count === 0) throw new ApiError(400, OrderErrorCode.STOCK_INSUFFICIENT);

        // Flip the product to out-of-stock the moment this sale empties it.
        await syncProductStockFlag(tx, item.productId);

        const itemSubtotal = price.mul(item.quantity);
        subtotal = subtotal.add(itemSubtotal);

        orderItems.push({
          productId: item.productId,
          variantId,
          quantity: item.quantity,
          price,
          // Snapshot alongside the price — a later rename must not rewrite what this
          // customer actually bought.
          productName: product.name,
          variantName,
        });
      }

      if (subtotal.lte(0)) throw new ApiError(400, OrderErrorCode.CART_EMPTY);

      let discount = new Decimal(0);
      let couponId: string | undefined;
      if (data.couponCode) {
        const { discount: calcDiscount } = await validateCouponService({ type: 'user', id: userId }, data.couponCode, subtotal, subtotal);
        discount = calcDiscount;

        // Fetch coupon
        const coupon = await tx.coupon.findUnique({
          where: { code: data.couponCode.toUpperCase().trim() },
        });
        if (!coupon) throw new ApiError(400, OrderErrorCode.COUPON_INVALID);

        // Conditional increment
        const updatedCouponCount = await tx.coupon.updateMany({
          where: { id: coupon.id, usedCount: { lt: coupon.usageLimit ?? 999999 } }, // Large number for unlimited
          data: { usedCount: { increment: 1 } },
        });

        if (updatedCouponCount.count === 0) throw new ApiError(400, OrderErrorCode.COUPON_USAGE_LIMIT_REACHED);

        couponId = coupon.id;
      }

      let shippingCharges = precomputedShipping;

      let total = subtotal.sub(discount).add(shippingCharges);
      if (total.lt(0)) total = new Decimal(0);

      // Round all
      subtotal = subtotal.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
      discount = discount.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
      shippingCharges = shippingCharges.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
      total = total.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);

      // The split is derived HERE, from the total this transaction is about to persist —
      // never from the earlier quote. That is what makes the "coupon changed the total
      // between quote and order" race structurally impossible rather than merely unlikely.
      let depositAmount: Decimal | null = null;
      let balanceAmount: Decimal | null = null;

      if (wantsPartial) {
        if (total.gt(maxPartialOrderValue())) {
          throw new ApiError(400, OrderErrorCode.PARTIAL_ORDER_VALUE_EXCEEDED);
        }
        if (!isPartialSplittable(total, partialTerms.depositPercent)) {
          throw new ApiError(400, OrderErrorCode.PARTIAL_AMOUNT_TOO_SMALL);
        }
        const split = splitDeposit(total, partialTerms.depositPercent);
        depositAmount = split.deposit;
        balanceAmount = split.balance;
      }

      try {
        const order = await tx.order.create({
          data: {
            userId,
            addressId: data.addressId,
            couponId,
            subtotal,
            discount,
            shippingCharges,
            total,
            affiliateId,
            idempotencyKey,
            paymentPlan: wantsPartial ? "PARTIAL" : "FULL",
            depositAmount,
            balanceAmount,
            // Persisted at creation. It was validated by the controller and then
            // dropped, so every order was born ONLINE (the schema default) and only
            // became COD if /payments/cod happened to be called. Shipping rates and
            // COD serviceability both need to know the intent before that point.
            paymentMethod: data.paymentMethod,
          },
        });

        await tx.orderItem.createMany({
          data: orderItems.map(item => ({ ...item, orderId: order.id })),
        });

        // The cart is deliberately NOT cleared here — nothing has been paid yet.
        // Clearing it now strands a user whose payment fails with an empty cart and
        // no way to retry. It is cleared on each confirmation path in
        // payment.services.ts (verify, COD, and the payment.captured webhook).

        return {
          orderId: order.id,
          subtotal: order.subtotal.toNumber(),
          discount: order.discount.toNumber(),
          shippingCharges: order.shippingCharges.toNumber(),
          total: order.total.toNumber(),
          paymentPlan: order.paymentPlan,
          amountDueNow: (order.depositAmount ?? order.total).toNumber(),
          balanceDue: order.balanceAmount?.toNumber() ?? 0,
          isNew: true,
        };
      } catch (err: any) {
        if (err.message.includes('Unique constraint failed')) { // General check for P2002 without Prisma code
          // Idempotency key conflict; retry query for existing
          const conflictingOrder = await tx.order.findUnique({
            where: { idempotencyKey },
          });
          if (conflictingOrder && conflictingOrder.userId === userId) {
            return {
              orderId: conflictingOrder.id,
              subtotal: conflictingOrder.subtotal.toNumber(),
              discount: conflictingOrder.discount.toNumber(),
              shippingCharges: conflictingOrder.shippingCharges.toNumber(),
              total: conflictingOrder.total.toNumber(),
              paymentPlan: conflictingOrder.paymentPlan,
              amountDueNow: (conflictingOrder.depositAmount ?? conflictingOrder.total).toNumber(),
              balanceDue: conflictingOrder.balanceAmount?.toNumber() ?? 0,
              isNew: false,
            };
          }
          throw new ApiError(409, OrderErrorCode.IDEMPOTENCY_KEY_CONFLICT);
        }
        throw err;
      }
    }); // Removed isolationLevel; use default RepeatableRead for alternative, or configure DB level
  });

  // No notification here: an Order row exists but nothing has been paid yet. The
  // customer is told only once the order is genuinely confirmed —
  // emitOrderConfirmed() in payment.services.ts covers all three confirmation
  // paths (signature verify, payment.captured webhook, and COD).
  const { isNew: _isNew, ...order } = result;
  return order;
}

export async function getOrdersService(userId: string, page: number, limit: number, status?: string) {
  const skip = (page - 1) * limit;

  const where: any = { userId, deletedAt: null }; // Use any to avoid type issues
  if (status) {
    // Prisma throws on an unknown enum value, which surfaced as a 500 for anything
    // the caller typed into ?status=.
    if (!Object.values(OrderStatus).includes(status as OrderStatus)) {
      throw new ApiError(400, OrderErrorCode.INVALID_STATUS_TRANSITION);
    }
    where.status = status;
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        subtotal: true,
        discount: true,
        shippingCharges: true,
        total: true,
        status: true,
        createdAt: true,
        items: {
          select: {
            productId: true,
            variantId: true,
            quantity: true,
            price: true,
            product: { select: { images: { where: { variantId: null, deletedAt: null }, orderBy: { sortOrder: "asc" }, select: { url: true }, take: 1 } } },
            variant: { select: { images: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" }, select: { url: true }, take: 1 } } },
          },
        },
        payment: { select: { status: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return { 
    orders: orders.map(order => ({
      ...order,
      subtotal: order.subtotal.toNumber(),
      discount: order.discount.toNumber(),
      shippingCharges: order.shippingCharges.toNumber(),
      total: order.total.toNumber(),
      items: order.items.map(item => ({
        ...item,
        price: item.price.toNumber(),
      })),
    })),
    total, 
    page, 
    limit, 
    pages: Math.ceil(total / limit) 
  };
}

export async function getOrderByIdService(userId: string, id: string) {
  const order = await prisma.order.findFirst({
    where: { id, userId, deletedAt: null },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              images: { where: { variantId: null, deletedAt: null }, orderBy: { sortOrder: "asc" }, select: { url: true }, take: 1 },
            },
          },
          variant: { select: { id: true, name: true, images: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" }, select: { url: true }, take: 1 } } },
        },
      },
      payment: true,
      address: true,
      coupon: { select: { code: true } },
    },
  });

  if (!order) throw new ApiError(404, OrderErrorCode.ORDER_NOT_FOUND);

  return {
    ...order,
    subtotal: order.subtotal.toNumber(),
    discount: order.discount.toNumber(),
    shippingCharges: order.shippingCharges.toNumber(),
    total: order.total.toNumber(),
    items: order.items.map(item => ({
      ...item,
      price: item.price.toNumber(),
      // Prefer what was bought over what the product is called today. Falls back to
      // the live relation for rows placed before the snapshot column existed.
      productName: item.productName ?? item.product.name,
      variantName: item.variantName ?? item.variant?.name ?? null,
    })),
  };
}

/**
 * Invoices now live in invoice.services.ts, which issues a numbered, immutable
 * snapshot and renders a real PDF. The placeholder that used to sit here returned
 * unnumbered JSON and was never consumed by either client.
 */

export async function cancelOrderService(
  userId: string,
  orderId: string,
  reason?: string,
  opts: { confirmForfeit?: boolean } = {}
) {
  // Read the plan before the unwind so the refund policy can be decided from the state
  // the customer is actually cancelling.
  const preState = await prisma.order.findFirst({
    where: { id: orderId, userId, deletedAt: null },
    select: {
      paymentPlan: true,
      depositAmount: true,
      payment: { select: { status: true, balanceSettledAt: true } },
    },
  });

  // A deposit-paid partial order forfeits its deposit on cancellation. That is a
  // contractual consequence with the customer's money in it, so it needs an explicit
  // acknowledgement rather than being applied silently — and requiring the flag forces
  // the client to show the amount at the moment of the decision.
  const depositAtRisk =
    preState?.paymentPlan === "PARTIAL" && preState.payment?.status === "PARTIALLY_PAID";
  if (depositAtRisk && !opts.confirmForfeit) {
    throw new ApiError(400, OrderErrorCode.DEPOSIT_FORFEIT_CONFIRMATION_REQUIRED);
  }

  await runWithRetry(async () => {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, userId, deletedAt: null },
        include: { items: true },
      });

      if (!order) throw new ApiError(404, OrderErrorCode.ORDER_NOT_FOUND);
      if (order.userId !== userId) throw new ApiError(403, OrderErrorCode.UNAUTHORIZED_ACCESS);

      const cancellableStatuses = ['PENDING', 'CONFIRMED'];
      if (!cancellableStatuses.includes(order.status)) {
        throw new ApiError(400, OrderErrorCode.INVALID_STATUS_TRANSITION);
      }

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
      await syncProductStockFlags(tx, order.items.map((i) => i.productId));

      // Give the coupon use back, otherwise a cancelled order permanently consumes
      // a slot against the coupon's usage limit.
      if (order.couponId) {
        await tx.coupon.updateMany({
          where: { id: order.couponId, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        });
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' },
      });

      await tx.payment.updateMany({
        where: { orderId, status: { in: ['PENDING', 'INITIATED'] } },
        data: { status: 'FAILED' },
      });

      // A cancelled sale must not keep earning commission. The admin cancel path
      // already did this; the customer path didn't, so a self-cancelled order left
      // a payable commission behind.
      await reverseAffiliateCommissionsService({ tx, orderId, adminUserId: userId });

      return { orderId, status: 'CANCELLED' };
    });
  });

  // After the commit, never inside it — this makes an external Razorpay call.
  //
  // Scope encodes the forfeiture policy: a customer-cancelled partial order keeps its
  // deposit. Anything collected BEYOND the deposit is still returned — the customer only
  // forfeits their commitment, not money they paid toward a balance.
  const scope: RefundScope = depositAtRisk
    ? (preState?.payment?.balanceSettledAt ? 'BALANCE_ONLY' : 'NONE')
    : 'ALL';

  const refund = await refundOrderMoney(orderId, 'Order cancelled by customer', { scope });

  const forfeited = refund.status === 'forfeited';
  void notify({
    userId,
    type: 'ORDER_CANCELLED',
    title: 'Order cancelled',
    body: forfeited
      ? `Your order #${orderShortRef(orderId)} has been cancelled. As set out in our cancellation policy, the ${money(Number(preState?.depositAmount ?? 0))} deposit is retained.`
      : refund.status === 'initiated'
        ? `Your order #${orderShortRef(orderId)} has been cancelled and your refund has been initiated.`
        : `Your order #${orderShortRef(orderId)} has been cancelled.`,
    data: { screen: 'Order', orderId },
  });

  return { orderId, status: 'CANCELLED', refund: refund.status };
}

/**
 * The customer closed the payment sheet without paying.
 *
 * This is the one moment we know for certain that a checkout was abandoned, and it
 * was previously invisible to the backend — the clients only showed a toast, so the
 * stock sat held until the TTL expired. Releasing here returns it in milliseconds
 * instead of minutes.
 *
 * Unlike `cancelOrderService` this is deliberately silent: no notification, and no
 * error when there is nothing to do. It is called fire-and-forget from a UI event,
 * and a user who dismisses the sheet has not "had an order cancelled" in any sense
 * worth telling them about. Anything not releasable — already paid, already
 * confirmed, already gone — is simply left alone.
 */
export async function abandonOrderService(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId, deletedAt: null },
    select: { id: true, status: true, payment: { select: { status: true } } },
  });

  if (!order) throw new ApiError(404, OrderErrorCode.ORDER_NOT_FOUND);

  // Never release stock out from under money that has moved. The webhook can beat
  // this call, and a captured payment must keep its order.
  const paymentBlocks =
    order.payment != null &&
    !['INITIATED', 'PENDING', 'FAILED'].includes(order.payment.status);

  if (order.status !== 'PENDING' || paymentBlocks) {
    return { orderId, released: false, status: order.status };
  }

  const released = await runWithRetry(async () =>
    prisma.$transaction((tx) => releasePendingOrderStock(tx, orderId))
  );

  return { orderId, released, status: released ? 'CANCELLED' : order.status };
}
