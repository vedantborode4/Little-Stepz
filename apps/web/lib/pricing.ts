import type { PriceDisplay } from "../types/product"

export interface DisplayPrices {
  regular: number
  sale: number | null
  mode: PriceDisplay
  /** sale price is active (on sale) and cheaper than regular */
  showDiscount: boolean
  discountPct: number | null
}

// Loose structural shapes so product, cart-item, and wishlist-item objects all fit.
interface ProductPriceParts {
  price: string | number
  salePrice?: string | number | null
  isOnSale?: boolean
  priceDisplay?: PriceDisplay
}
interface VariantPriceParts {
  price?: string | number | null
  salePrice?: string | number | null
  isOnSale?: boolean
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
  const useVariant = variant != null && variant.price != null

  const regular = Number(useVariant ? variant!.price : product.price)
  const saleRaw = useVariant ? variant!.salePrice : product.salePrice
  const onSale = (useVariant ? variant!.isOnSale : product.isOnSale) ?? false
  const sale = saleRaw != null && saleRaw !== "" ? Number(saleRaw) : null

  const mode: PriceDisplay = product.priceDisplay ?? "BOTH"
  const showDiscount = onSale && sale != null && sale < regular
  const discountPct = showDiscount ? Math.round((1 - sale! / regular) * 100) : null

  return { regular, sale, mode, showDiscount, discountPct }
}

/**
 * The unit price actually charged — sale price when on sale, otherwise regular.
 * Mirrors the backend resolveChargedPrice.
 */
export function getChargedPrice(
  product: ProductPriceParts,
  variant?: VariantPriceParts | null
): number {
  const useVariant = variant != null && variant.price != null
  const regular = Number(useVariant ? variant!.price : product.price)
  const saleRaw = useVariant ? variant!.salePrice : product.salePrice
  const onSale = (useVariant ? variant!.isOnSale : product.isOnSale) ?? false
  const sale = saleRaw != null && saleRaw !== "" ? Number(saleRaw) : null
  return onSale && sale != null ? sale : regular
}

export const formatINR = (n: number) => `₹${n.toLocaleString("en-IN")}`
