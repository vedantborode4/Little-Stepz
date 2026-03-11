import { prisma } from '@repo/db/client';
import { ApiError } from '../utils/api';
import { CouponErrorCode } from '../utils/couponErrors';
import { Decimal } from 'decimal.js';

type CartIdentifier = { type: "user" | "session"; id: string };

// Helper to compute server-side subtotal
async function computeCartSubtotal(identifier: CartIdentifier): Promise<{ subtotal: Decimal; hasInvalidItems: boolean }> {
  const items = await prisma.cartItem.findMany({
    where: {
      ...(identifier.type === 'user' ? { userId: identifier.id, sessionId: null } : { sessionId: identifier.id, userId: null }),
      deletedAt: null,
    },
    include: {
      product: { select: { price: true, deletedAt: true, quantity: true } },
      variant: { select: { price: true, deletedAt: true, stock: true } },
    },
  });

  let subtotal = new Decimal(0);
  let hasInvalidItems = false;

  for (const item of items) {
    if (item.deletedAt || item.product.deletedAt || (item.variantId && item.variant?.deletedAt)) {
      hasInvalidItems = true;
      continue;
    }
    if (item.quantity <= 0) {
      hasInvalidItems = true;
      continue;
    }

    const stock = item.variant ? item.variant.stock : item.product.quantity;
    if (stock < item.quantity) {
      hasInvalidItems = true;
      continue;
    }

    const price = item.variant?.price ?? item.product.price;
    subtotal = subtotal.add(price.mul(item.quantity));
  }

  return { subtotal, hasInvalidItems };
}

// Note: This service does NOT mutate usedCount; that's done in order creation transaction
export async function validateCouponService(
  identifier: CartIdentifier,
  code: string,
  clientOrderAmount: Decimal,
  // When called from order creation the subtotal is already verified against real DB
  // prices — pass it here to skip the cart re-query (which would fail because the
  // orders route does not use cartMiddleware and cart items may be session-based).
  trustedSubtotal?: Decimal
): Promise<{ discount: Decimal }> {
  const normalizedCode = code.trim().toUpperCase();

  const coupon = await prisma.coupon.findUnique({
    where: { code: normalizedCode },
  });

  if (!coupon) throw new ApiError(404, CouponErrorCode.COUPON_NOT_FOUND);
  if (coupon.deletedAt) throw new ApiError(400, CouponErrorCode.COUPON_DELETED);
  if (!coupon.isActive) throw new ApiError(400, CouponErrorCode.COUPON_INACTIVE);

  const now = new Date();
  if (coupon.validFrom && coupon.validFrom > now) throw new ApiError(400, CouponErrorCode.COUPON_NOT_STARTED);
  if (coupon.validUntil && coupon.validUntil < now) throw new ApiError(400, CouponErrorCode.COUPON_EXPIRED);

  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw new ApiError(400, CouponErrorCode.COUPON_USAGE_LIMIT_REACHED);
  }

  // Use the pre-verified subtotal from order creation when available.
  // Otherwise fall back to re-querying the cart (used by the standalone
  // POST /coupons/validate endpoint which does have a cart identifier).
  let subtotal: Decimal;
  if (trustedSubtotal !== undefined) {
    subtotal = trustedSubtotal;
  } else {
    const { subtotal: cartSubtotal, hasInvalidItems } = await computeCartSubtotal(identifier);
    if (hasInvalidItems) throw new ApiError(400, CouponErrorCode.CART_HAS_INVALID_ITEMS);
    if (cartSubtotal.lte(0)) throw new ApiError(400, CouponErrorCode.CART_EMPTY);

    // Tamper-check only when we re-derived the subtotal ourselves
    if (!clientOrderAmount.equals(cartSubtotal) && clientOrderAmount.sub(cartSubtotal).abs().gt(0.01)) {
      console.warn(`Order amount mismatch: client=${clientOrderAmount}, server=${cartSubtotal}, identifier=${identifier.id}`);
      throw new ApiError(400, CouponErrorCode.ORDER_AMOUNT_MISMATCH);
    }
    subtotal = cartSubtotal;
  }

  if (subtotal.lte(0)) throw new ApiError(400, CouponErrorCode.CART_EMPTY);

  if (coupon.minOrderValue && subtotal.lt(coupon.minOrderValue)) {
    throw new ApiError(400, CouponErrorCode.MIN_ORDER_VALUE_NOT_MET);
  }

  let discount: Decimal;

  if (coupon.type === 'FIXED_AMOUNT') {
    discount = coupon.value;
    if (discount.gt(subtotal)) discount = subtotal; // Clamp to subtotal
  } else if (coupon.type === 'PERCENTAGE') {
    if (coupon.value.gt(100)) {
      console.warn(`Percentage > 100 for coupon ${coupon.id}`);
      // Clamp effective percentage to 100%
      discount = subtotal;
    } else {
      discount = subtotal.mul(coupon.value.div(100));
    }
    if (coupon.maxDiscount && discount.gt(coupon.maxDiscount)) discount = coupon.maxDiscount;
  } else {
    throw new ApiError(500, CouponErrorCode.INVALID_COUPON_TYPE);
  }

  // Round discount to 2 decimal places, banker's rounding
  discount = discount.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);

  if (discount.lt(0)) discount = new Decimal(0); // Safety

  return { discount };
}