import type { PriceDisplay, Product, Variant } from "../types/product";

export interface DisplayPrices {
  regular: number;
  sale: number | null;
  mode: PriceDisplay;
  /** sale price is active (on sale) and cheaper than regular */
  showDiscount: boolean;
  discountPct: number | null;
}

// Loose structural shapes so product, cart-item, and wishlist-item objects all fit.
interface ProductPriceParts {
  price: string | number;
  salePrice?: string | number | null;
  isOnSale?: boolean;
  priceDisplay?: PriceDisplay;
}
interface VariantPriceParts {
  price?: string | number | null;
  salePrice?: string | number | null;
  isOnSale?: boolean;
}

/**
 * Resolves the prices to display for a product / selected variant.
 * Mirrors the backend charge resolution: a variant overrides the product's
 * pricing only when it sets its own regular price.
 */
export function getDisplayPrices(
  product: ProductPriceParts,
  variant?: VariantPriceParts | null
): DisplayPrices {
  const useVariant = variant != null && variant.price != null;

  const regular = Number(useVariant ? variant!.price : product.price);
  const saleRaw = useVariant ? variant!.salePrice : product.salePrice;
  const onSale = (useVariant ? variant!.isOnSale : product.isOnSale) ?? false;
  const sale = saleRaw != null && saleRaw !== "" ? Number(saleRaw) : null;

  const mode: PriceDisplay = product.priceDisplay ?? "BOTH";
  const showDiscount = onSale && sale != null && sale < regular;
  const discountPct = showDiscount ? Math.round((1 - sale! / regular) * 100) : null;

  return { regular, sale, mode, showDiscount, discountPct };
}

/**
 * The unit price actually charged — sale price when on sale, otherwise regular.
 * Mirrors the backend resolveChargedPrice.
 */
export function getChargedPrice(
  product: ProductPriceParts,
  variant?: VariantPriceParts | null
): number {
  const useVariant = variant != null && variant.price != null;
  const regular = Number(useVariant ? variant!.price : product.price);
  const saleRaw = useVariant ? variant!.salePrice : product.salePrice;
  const onSale = (useVariant ? variant!.isOnSale : product.isOnSale) ?? false;
  const sale = saleRaw != null && saleRaw !== "" ? Number(saleRaw) : null;
  return onSale && sale != null ? sale : regular;
}

/**
 * Charged-price span across the base product and all its variants. Used by the
 * product card to show "From ₹X" when variants make the price a range. The base
 * product (no variant) is included because it stays purchasable on its own.
 */
export function getPriceRange(
  product: ProductPriceParts,
  variants?: VariantPriceParts[] | null
): { min: number; max: number; single: boolean } {
  const prices = [getChargedPrice(product, null)];
  if (Array.isArray(variants)) {
    for (const v of variants) prices.push(getChargedPrice(product, v));
  }
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return { min, max, single: min === max };
}

/**
 * Pre-order terms for a product/variant pairing. Mirrors apps/web/lib/pricing.ts and
 * the backend's utils/preOrderTerms.ts — keep all three in sync.
 *
 * The product switch is the master: a variant can only opt OUT. A null variant
 * bookingAmount inherits the product's, exactly like `price` overrides do.
 */
export function getPreOrderTerms(
  product: Pick<Product, "preOrderEnabled" | "bookingAmount" | "inStock" | "quantity">,
  variant?: Pick<Variant, "preOrderEnabled" | "bookingAmount" | "stock"> | null,
): { enabled: boolean; bookingAmount: number | null; canPreOrder: boolean } {
  const enabled = !!product.preOrderEnabled && (variant ? variant.preOrderEnabled !== false : true);

  const raw = variant?.bookingAmount ?? product.bookingAmount;
  const bookingAmount = raw == null || raw === "" ? null : Number(raw);

  // Pre-order is for what you cannot buy right now: the chosen variant's stock when
  // one is selected, otherwise the base product's own availability.
  const outOfStock = variant ? (variant.stock ?? 0) <= 0 : !product.inStock || (product.quantity ?? 0) <= 0;

  return {
    enabled,
    bookingAmount,
    canPreOrder: enabled && outOfStock && bookingAmount != null && bookingAmount > 0,
  };
}


/**
 * Partial-payment terms for a product/variant pairing — the client mirror of the
 * backend's `resolvePartialTerms`.
 *
 * Display only. The deposit shown on a product page is indicative: the real split is
 * computed server-side from the ORDER total (after discount, plus shipping) with the
 * balance rounded to whole rupees, so it will not always be exactly this percentage of
 * the item price. Checkout always renders the server's figures, never these.
 *
 * Same inheritance rule as pre-orders: the product switch is master, a variant may only
 * opt out, and a null percentage inherits.
 */
export function getPartialPaymentTerms(
  product: { partialPaymentEnabled?: boolean; depositPercent?: unknown },
  variant?: { partialPaymentEnabled?: boolean; depositPercent?: unknown } | null,
  fallbackPercent = 20,
): { enabled: boolean; depositPercent: number } {
  const enabled =
    !!product.partialPaymentEnabled && (variant ? variant.partialPaymentEnabled !== false : true)

  const raw = variant?.depositPercent ?? product.depositPercent
  const parsed = raw == null || raw === "" ? NaN : Number(raw)
  const depositPercent =
    Number.isFinite(parsed) && parsed > 0 && parsed < 100 ? parsed : fallbackPercent

  return { enabled, depositPercent }
}
