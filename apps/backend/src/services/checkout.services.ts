import { prisma } from "@repo/db/client";
import { ApiError } from "../utils/api";
import { OrderErrorCode } from "../utils/orderErrors";
import { Decimal } from "decimal.js";
import type { CheckoutCalculateBody} from "@repo/zod-schema/index";
import { validateCouponService } from "./coupons.services"; 

//decide later 
async function calculateShipping(addressId: string): Promise<Decimal> {
  return new Decimal(5.00);
}

interface CheckoutResult {
  subtotal: Decimal;
  discount: Decimal;
  shippingCharges: Decimal;
  total: Decimal;
  items: Array<{ productId: string; variantId?: string; quantity: number; price: Decimal; subtotal: Decimal }>;
}

export async function calculateCheckoutService(userId: string, data: CheckoutCalculateBody): Promise<CheckoutResult> {
  const { cartItems, addressId, couponCode } = data;

  if (cartItems.length === 0) throw new ApiError(400, OrderErrorCode.CART_EMPTY);

  // Validate address belongs to user
  const address = await prisma.address.findFirst({
    where: { id: addressId, userId, deletedAt: null },
  });
  if (!address) throw new ApiError(400, OrderErrorCode.INVALID_ADDRESS);

  let subtotal = new Decimal(0);
  const enhancedItems: CheckoutResult["items"] = [];

  // Fetch products and variants in batch to avoid N+1
  const productIds = cartItems.map(item => item.productId);
  const variantIds = cartItems.map(item => item.variantId).filter(Boolean) as string[];

  const [products, variants] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: productIds }, deletedAt: null },
      select: { id: true, price: true, quantity: true, inStock: true },
    }),
    prisma.variant.findMany({
      where: { id: { in: variantIds }, deletedAt: null },
      select: { id: true, price: true, stock: true, productId: true },
    }),
  ]);

  const productMap = new Map(products.map(p => [p.id, p]));
  const variantMap = new Map(variants.map(v => [v.id, v]));

  let hasInvalidItems = false;

  for (const item of cartItems) {
    const product = productMap.get(item.productId);
    if (!product || !product.inStock) {
      hasInvalidItems = true;
      continue;
    }

    let price: Decimal;
    let stock: number;

    if (item.variantId) {
      const variant = variantMap.get(item.variantId);
      if (!variant || variant.productId !== item.productId) {
        hasInvalidItems = true;
        continue;
      }
    
      price = variant.price ?? product.price;
      stock = variant.stock;
    } else {
      price = product.price;
      stock = product.quantity;
    }

    if (item.quantity <= 0 || item.quantity > stock) {
      hasInvalidItems = true;
      continue;
    }

    const itemSubtotal = price.mul(item.quantity);
    subtotal = subtotal.add(itemSubtotal);
    enhancedItems.push({ ...item, price, subtotal: itemSubtotal });
  }

  if (hasInvalidItems) throw new ApiError(400, OrderErrorCode.CART_HAS_INVALID_ITEMS);
  if (subtotal.lte(0)) throw new ApiError(400, OrderErrorCode.CART_EMPTY);

  let discount = new Decimal(0);
  if (couponCode) {
    const { discount: calcDiscount } = await validateCouponService({ type: "user", id: userId }, couponCode, subtotal);
    discount = calcDiscount;
  }

  let shippingCharges = await calculateShipping(addressId);

  let total = subtotal.sub(discount).add(shippingCharges);
  if (total.lt(0)) total = new Decimal(0); // Safety

  subtotal = subtotal.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
  discount = discount.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
  shippingCharges = shippingCharges.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
  total = total.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);

  return { subtotal, discount, shippingCharges, total, items: enhancedItems };
}