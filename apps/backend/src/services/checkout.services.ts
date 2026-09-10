import { prisma } from "@repo/db/client";
import { ApiError } from "../utils/api";
import { OrderErrorCode } from "../utils/orderErrors";
import { resolveChargedPrice } from "../utils/pricing";
import { Decimal } from "decimal.js";
import type { CheckoutCalculateBody} from "@repo/zod-schema/index";
import { validateCouponService } from "./coupons.services";
import { assertServiceable, resolveShippingCharge, isCodCollectable } from "../utils/shipping";
import { checkServiceability } from "../utils/delhivery.client";
import {
  isPartialPaymentEnabled,
  resolveCartPartialTerms,
  splitDeposit,
  isPartialSplittable,
  maxPartialOrderValue,
  maxOpenPartialOrders,
} from "../utils/partialPayment";
import { isPhoneVerified } from "./phoneVerification.services";
import {
  isCodEnabled,
  maxCodOrderValue,
  maxOpenCodOrders,
  codRefusalLimit,
  resolveCartCodEnabled,
  openCodOrderWhere,
  codRefusalWhere,
} from "../utils/cod";

/**
 * Why partial payment is not on offer. Codes only, no prose — the copy lives in
 * @repo/content so the two storefronts and the policy pages cannot drift apart.
 */
export type PartialIneligibilityReason =
  | { code: "PARTIAL_PAYMENT_DISABLED" }
  | { code: "ITEMS_NOT_ELIGIBLE"; meta: { count: number } }
  | { code: "PINCODE_COD_UNAVAILABLE"; meta: { pincode: string } }
  | { code: "PHONE_NOT_VERIFIED" }
  | { code: "ORDER_VALUE_ABOVE_CAP"; meta: { cap: number } }
  | { code: "TOO_MANY_OPEN_BALANCES"; meta: { open: number; limit: number } }
  | { code: "PARTIAL_AMOUNT_TOO_SMALL" };

export interface PartialPaymentQuote {
  eligible: boolean;
  depositPercent: number;
  /** Server-computed and authoritative — clients must never derive these. */
  depositAmount: number;
  balanceAmount: number;
  reasons: PartialIneligibilityReason[];
}

/** Why Cash on Delivery is not on offer. Copy lives in @repo/content (`codReasonText`). */
export type CodIneligibilityReason =
  | { code: "COD_DISABLED" }
  | { code: "ITEMS_NOT_ELIGIBLE"; meta: { count: number } }
  | { code: "ORDER_VALUE_ABOVE_CAP"; meta: { cap: number } }
  | { code: "TOO_MANY_OPEN_COD_ORDERS"; meta: { open: number; limit: number } }
  | { code: "COD_BLOCKED_REFUSALS" }
  | { code: "PHONE_NOT_VERIFIED" }
  | { code: "PINCODE_COD_UNAVAILABLE"; meta: { pincode: string } };

export interface CodPaymentQuote {
  eligible: boolean;
  /** Collected in full at the door — the order total. */
  amountDue: number;
  reasons: CodIneligibilityReason[];
}

export async function checkServiceabilityService(pincode: string) {
  return checkServiceability(pincode);
}

interface CheckoutResult {
  subtotal: Decimal;
  discount: Decimal;
  shippingCharges: Decimal;
  total: Decimal;
  items: Array<{ productId: string; variantId?: string; quantity: number; price: Decimal; subtotal: Decimal }>;
  /** Always returned, whichever plan was asked for, so one call renders both options. */
  partialPayment: PartialPaymentQuote;
  /** Always returned too, so the checkout renders all three options from one call. */
  codPayment: CodPaymentQuote;
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
      select: {
        id: true, price: true, salePrice: true, isOnSale: true, quantity: true, inStock: true,
        partialPaymentEnabled: true, depositPercent: true,
        codEnabled: true,
      },
    }),
    prisma.variant.findMany({
      where: { id: { in: variantIds }, deletedAt: null },
      select: {
        id: true, price: true, salePrice: true, isOnSale: true, stock: true, productId: true,
        partialPaymentEnabled: true, depositPercent: true,
        codEnabled: true,
      },
    }),
  ]);

  const productMap = new Map(products.map(p => [p.id, p]));
  const variantMap = new Map(variants.map(v => [v.id, v]));

  // Resolved from the rows already loaded above — no extra queries.
  const partialTerms = resolveCartPartialTerms(
    cartItems.map((item) => ({
      product: productMap.get(item.productId) ?? { partialPaymentEnabled: false, depositPercent: null },
      variant: item.variantId ? variantMap.get(item.variantId) ?? null : null,
    }))
  );
  const ineligibleItemCount = cartItems.filter((item) => {
    const product = productMap.get(item.productId);
    if (!product?.partialPaymentEnabled) return true;
    const variant = item.variantId ? variantMap.get(item.variantId) : null;
    return variant ? !variant.partialPaymentEnabled : false;
  }).length;

  const codCartEnabled = resolveCartCodEnabled(
    cartItems.map((item) => ({
      product: productMap.get(item.productId) ?? { codEnabled: false },
      variant: item.variantId ? variantMap.get(item.variantId) ?? null : null,
    }))
  );
  const codIneligibleItemCount = cartItems.filter((item) => {
    const product = productMap.get(item.productId);
    if (!product?.codEnabled) return true;
    const variant = item.variantId ? variantMap.get(item.variantId) : null;
    return variant ? !variant.codEnabled : false;
  }).length;

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

      price = resolveChargedPrice(product, variant);
      stock = variant.stock;
    } else {
      price = resolveChargedPrice(product);
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

  // Hard serviceability only. Whether the courier can also collect cash is reported as data
  // in the COD and deposit quotes below, so a COD-only restriction must not fail the whole
  // quote — and published builds still send paymentMethod: COD to this endpoint.
  await assertServiceable(address.pincode, "ONLINE");
  let shippingCharges = await resolveShippingCharge(address.pincode, data.paymentMethod);

  let total = subtotal.sub(discount).add(shippingCharges);
  if (total.lt(0)) total = new Decimal(0); // Safety

  subtotal = subtotal.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
  discount = discount.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
  shippingCharges = shippingCharges.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
  total = total.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);

  // A COD order and a deposit order both travel on a COD manifest, and createOrderService
  // charges the COD rate for them. Their quotes must use that rate too, or the amount shown
  // at checkout is less than what the order charges and the courier collects.
  const codShipping =
    data.paymentMethod === "COD"
      ? shippingCharges
      : (await resolveShippingCharge(address.pincode, "COD")).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
  let codTotal = subtotal.sub(discount).add(codShipping);
  if (codTotal.lt(0)) codTotal = new Decimal(0);
  codTotal = codTotal.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);

  // Both plans need the same Delhivery COD lookup — an HTTP round-trip — so ask once.
  let codCheck: Promise<boolean> | null = null;
  const codCollectable = () => (codCheck ??= isCodCollectable(address.pincode));

  const [partialPayment, codPayment] = await Promise.all([
    quotePartialPayment({
      userId,
      total: codTotal,
      pincode: address.pincode,
      phone: address.phone,
      terms: partialTerms,
      ineligibleItemCount,
      codCollectable,
    }),
    quoteCodPayment({
      userId,
      total: codTotal,
      pincode: address.pincode,
      phone: address.phone,
      cartEnabled: codCartEnabled,
      ineligibleItemCount: codIneligibleItemCount,
      codCollectable,
    }),
  ]);

  return {
    subtotal, discount, shippingCharges, total, items: enhancedItems, partialPayment, codPayment,
  };
}

/**
 * Can this cart be paid 20% now and the rest on delivery, and if not, why not?
 *
 * Every gate is reported rather than the first failure, so the storefront can explain
 * itself instead of silently hiding an option the customer's friend was offered. The
 * checks run cheapest-first and the Delhivery lookup only happens once everything local
 * has passed — there is no point asking the courier about an order we would refuse anyway.
 *
 * This mirrors `createOrderService`, which re-asserts all of it authoritatively. Nothing
 * here is trusted: a quote is a display hint, and eligibility can lapse between the two.
 */
async function quotePartialPayment(args: {
  userId: string;
  total: Decimal;
  pincode: string;
  phone: string;
  terms: { enabled: boolean; depositPercent: Decimal };
  ineligibleItemCount: number;
  codCollectable: () => Promise<boolean>;
}): Promise<PartialPaymentQuote> {
  const { userId, total, pincode, phone, terms, ineligibleItemCount, codCollectable } = args;
  const reasons: PartialIneligibilityReason[] = [];

  const split = splitDeposit(total, terms.depositPercent);
  const base = {
    depositPercent: terms.depositPercent.toNumber(),
    depositAmount: split.deposit.toNumber(),
    balanceAmount: split.balance.toNumber(),
  };

  if (!isPartialPaymentEnabled()) {
    return { ...base, eligible: false, reasons: [{ code: "PARTIAL_PAYMENT_DISABLED" }] };
  }

  if (!terms.enabled) {
    reasons.push({ code: "ITEMS_NOT_ELIGIBLE", meta: { count: ineligibleItemCount } });
  }

  const cap = maxPartialOrderValue();
  if (total.gt(cap)) {
    reasons.push({ code: "ORDER_VALUE_ABOVE_CAP", meta: { cap: cap.toNumber() } });
  }

  if (!isPartialSplittable(total, terms.depositPercent)) {
    reasons.push({ code: "PARTIAL_AMOUNT_TOO_SMALL" });
  }

  // Phone verification follows REQUIRE_VERIFIED_PHONE_AT_CHECKOUT rather than being
  // required by partial payment alone — see the note in createOrderService. Skipping the
  // lookup entirely when the flag is off also saves a query on every quote.
  const requirePhone = process.env.REQUIRE_VERIFIED_PHONE_AT_CHECKOUT === "true";

  const limit = maxOpenPartialOrders();
  const [openBalances, phoneVerified] = await Promise.all([
    prisma.order.count({
      where: {
        userId,
        paymentPlan: "PARTIAL",
        deletedAt: null,
        depositPaidAt: { not: null },
        payment: { status: "PARTIALLY_PAID" },
      },
    }),
    requirePhone ? isPhoneVerified(userId, phone) : Promise.resolve(true),
  ]);

  if (openBalances >= limit) {
    reasons.push({ code: "TOO_MANY_OPEN_BALANCES", meta: { open: openBalances, limit } });
  }
  if (!phoneVerified) {
    reasons.push({ code: "PHONE_NOT_VERIFIED" });
  }

  // Last, and only if it can still change the answer: this one is an HTTP round-trip.
  if (reasons.length === 0 && !(await codCollectable())) {
    reasons.push({ code: "PINCODE_COD_UNAVAILABLE", meta: { pincode } });
  }

  return { ...base, eligible: reasons.length === 0, reasons };
}

/**
 * Can this cart be paid in full by Cash on Delivery, and if not, why not?
 *
 * Mirrors `quotePartialPayment`: every gate is reported rather than the first failure, the
 * Delhivery lookup runs last and only if it can still change the answer, and nothing here is
 * trusted — `createOrderService` and `createCodPaymentService` re-assert all of it.
 */
async function quoteCodPayment(args: {
  userId: string;
  total: Decimal;
  pincode: string;
  phone: string;
  cartEnabled: boolean;
  ineligibleItemCount: number;
  codCollectable: () => Promise<boolean>;
}): Promise<CodPaymentQuote> {
  const { userId, total, pincode, phone, cartEnabled, ineligibleItemCount, codCollectable } = args;
  const amountDue = total.toNumber();

  if (!isCodEnabled()) {
    return { eligible: false, amountDue, reasons: [{ code: "COD_DISABLED" }] };
  }

  const reasons: CodIneligibilityReason[] = [];

  if (!cartEnabled) {
    reasons.push({ code: "ITEMS_NOT_ELIGIBLE", meta: { count: ineligibleItemCount } });
  }

  const cap = maxCodOrderValue();
  if (total.gt(cap)) {
    reasons.push({ code: "ORDER_VALUE_ABOVE_CAP", meta: { cap: cap.toNumber() } });
  }

  const requirePhone = process.env.REQUIRE_VERIFIED_PHONE_AT_CHECKOUT === "true";
  const [open, refused, phoneVerified] = await Promise.all([
    prisma.order.count({ where: openCodOrderWhere(userId) }),
    prisma.order.count({ where: codRefusalWhere(userId) }),
    requirePhone ? isPhoneVerified(userId, phone) : Promise.resolve(true),
  ]);

  if (refused >= codRefusalLimit()) {
    reasons.push({ code: "COD_BLOCKED_REFUSALS" });
  }

  const limit = maxOpenCodOrders();
  if (open >= limit) {
    reasons.push({ code: "TOO_MANY_OPEN_COD_ORDERS", meta: { open, limit } });
  }

  if (!phoneVerified) {
    reasons.push({ code: "PHONE_NOT_VERIFIED" });
  }

  if (reasons.length === 0 && !(await codCollectable())) {
    reasons.push({ code: "PINCODE_COD_UNAVAILABLE", meta: { pincode } });
  }

  return { eligible: reasons.length === 0, amountDue, reasons };
}
