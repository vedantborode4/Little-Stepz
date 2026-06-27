import { Decimal } from "decimal.js";

type ProductPriceParts = {
  price: Decimal;
  salePrice?: Decimal | null;
  isOnSale?: boolean;
};

type VariantPriceParts = {
  price?: Decimal | null;
  salePrice?: Decimal | null;
  isOnSale?: boolean;
};

/**
 * Resolves the price a customer is actually charged for a product / variant.
 * The `isOnSale` toggle decides whether the sale price or the regular price is charged.
 * A variant overrides the product's pricing only when the variant sets its own regular price.
 */
export function resolveChargedPrice(
  product: ProductPriceParts,
  variant?: VariantPriceParts | null
): Decimal {
  const useVariant = variant != null && variant.price != null;

  const regular = useVariant ? variant!.price! : product.price;
  const sale = useVariant ? variant!.salePrice : product.salePrice;
  const onSale = useVariant ? variant!.isOnSale : product.isOnSale;

  return onSale && sale != null ? sale : regular;
}

type SanitizableVariant = { isOnSale?: boolean; salePrice?: unknown };
type SanitizableProduct = { isOnSale?: boolean; salePrice?: unknown; variants?: SanitizableVariant[] };

/**
 * Strips the sale price from a public product/variant payload unless it is actually
 * on sale — so the frontend never receives a sale price that isn't in effect.
 */
export function withPublicSalePricing<T extends SanitizableProduct>(product: T): T {
  const variants = Array.isArray(product.variants)
    ? product.variants.map((v) => ({ ...v, salePrice: v.isOnSale ? v.salePrice : null }))
    : product.variants;

  return {
    ...product,
    salePrice: product.isOnSale ? product.salePrice : null,
    variants,
  } as T;
}
