import { prisma } from '@repo/db/client';
import { ApiError } from '../utils/api';
import { OrderErrorCode } from '../utils/orderErrors';
import { Decimal } from 'decimal.js';
import type { CreateOrderBody } from '@repo/zod-schema/index';
import { validateCouponService } from './coupons.services';

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

async function calculateShipping(addressId: string): Promise<Decimal> {
  return new Decimal(5.00);
}


const MAX_CART_ITEMS = 100;

export async function createOrderService(userId: string, data: CreateOrderBody, idempotencyKey: string, affiliateId?: string) {
  return await runWithRetry(async () => {
    return await prisma.$transaction(async (tx) => {
      
      const existingOrder = await tx.order.findUnique({
        where: { idempotencyKey },
      });
      if (existingOrder) {
        if (existingOrder.userId !== userId) throw new ApiError(403, OrderErrorCode.UNAUTHORIZED_ACCESS);
        return { orderId: existingOrder.id, subtotal: existingOrder.subtotal.toNumber(), discount: existingOrder.discount.toNumber(), shippingCharges: existingOrder.shippingCharges.toNumber(), total: existingOrder.total.toNumber() }; // Idempotent return
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

      const products = await tx.product.findMany({
        where: { id: { in: productIds }, deletedAt: null },
        select: { id: true, price: true, quantity: true, inStock: true },
      });

      const variants = await tx.variant.findMany({
        where: { id: { in: variantIds }, deletedAt: null },
        select: { id: true, price: true, stock: true, productId: true },
      });

      const productMap = new Map(products.map(p => [p.id, p]));
      const variantMap = new Map(variants.map(v => [v.id, v]));

      for (const item of data.cartItems) {
        const product = productMap.get(item.productId);
        if (!product || !product.inStock) throw new ApiError(400, OrderErrorCode.PRODUCT_DELETED);

        let price: Decimal;
        let stock: number;
        let variantId = item.variantId;

        if (variantId) {
          const variant = variantMap.get(variantId);
          if (!variant || variant.productId !== item.productId) throw new ApiError(400, OrderErrorCode.VARIANT_DELETED);
          price = variant.price ?? product.price;
          stock = variant.stock;
        } else {
          price = product.price;
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

        const itemSubtotal = price.mul(item.quantity);
        subtotal = subtotal.add(itemSubtotal);

        orderItems.push({
          productId: item.productId,
          variantId,
          quantity: item.quantity,
          price,
        });
      }

      if (subtotal.lte(0)) throw new ApiError(400, OrderErrorCode.CART_EMPTY);

      let discount = new Decimal(0);
      let couponId: string | undefined;
      if (data.couponCode) {
        const { discount: calcDiscount } = await validateCouponService({ type: 'user', id: userId }, data.couponCode, subtotal);
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

      let shippingCharges = await calculateShipping(data.addressId);

      let total = subtotal.sub(discount).add(shippingCharges);
      if (total.lt(0)) total = new Decimal(0);

      // Round all
      subtotal = subtotal.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
      discount = discount.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
      shippingCharges = shippingCharges.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
      total = total.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);

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
          },
        });

        await tx.orderItem.createMany({
          data: orderItems.map(item => ({ ...item, orderId: order.id })),
        });

        // Create payment record (stub; integrate gateway)
        await tx.payment.create({
          data: {
            orderId: order.id,
            gateway: 'stripe', // Stub
            amount: total,
          },
        });

        // Clear cart
        await tx.cartItem.updateMany({
          where: { userId, deletedAt: null },
          data: { deletedAt: new Date() },
        });


        return { orderId: order.id, subtotal: order.subtotal.toNumber(), discount: order.discount.toNumber(), shippingCharges: order.shippingCharges.toNumber(), total: order.total.toNumber() };
      } catch (err: any) {
        if (err.message.includes('Unique constraint failed')) { // General check for P2002 without Prisma code
          // Idempotency key conflict; retry query for existing
          const conflictingOrder = await tx.order.findUnique({
            where: { idempotencyKey },
          });
          if (conflictingOrder && conflictingOrder.userId === userId) {
            return { orderId: conflictingOrder.id, subtotal: conflictingOrder.subtotal.toNumber(), discount: conflictingOrder.discount.toNumber(), shippingCharges: conflictingOrder.shippingCharges.toNumber(), total: conflictingOrder.total.toNumber() };
          }
          throw new ApiError(409, OrderErrorCode.IDEMPOTENCY_KEY_CONFLICT);
        }
        throw err;
      }
    }); // Removed isolationLevel; use default RepeatableRead for alternative, or configure DB level
  });
}

export async function getOrdersService(userId: string, page: number, limit: number, status?: string) {
  const skip = (page - 1) * limit;

  const where: any = { userId, deletedAt: null }; // Use any to avoid type issues
  if (status) where.status = status;

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
          select: { productId: true, variantId: true, quantity: true, price: true },
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
      items: true,
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
    })),
  };
}

export async function getOrderInvoiceService(userId: string, id: string) {
  const order = await getOrderByIdService(userId, id);

  // Generate invoice data; use PDF lib in prod, here return JSON structure
  return {
    orderId: order.id,
    date: order.createdAt,
    items: order.items.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      price: item.price,
      subtotal: item.price * item.quantity,
    })),
    subtotal: order.subtotal,
    discount: order.discount,
    shipping: order.shippingCharges,
    total: order.total,
    status: order.status,
    address: order.address,
    coupon: order.coupon?.code,
  };
}