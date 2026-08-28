import type { Product, Variant } from "../../types/product"

/** optionId -> selected valueId */
export type Selection = Record<string, string>

const variantValueIds = (v: Variant): Set<string> =>
  new Set((v.optionValues ?? []).map((o) => o.optionValueId))

export function isSelectionComplete(product: Product, selection: Selection): boolean {
  const opts = product.options ?? []
  return opts.length > 0 && opts.every((o) => selection[o.id])
}

/** The variant whose option-value set exactly matches a complete selection. */
export function findVariant(product: Product, selection: Selection): Variant | null {
  if (!isSelectionComplete(product, selection)) return null
  const wanted = Object.values(selection)
  for (const v of product.variants) {
    const ids = variantValueIds(v)
    if (ids.size === wanted.length && wanted.every((id) => ids.has(id))) return v
  }
  return null
}

/**
 * Which variants count as selectable.
 *
 * - `in-stock` (default): normal buying — only combinations you can add to a cart.
 * - `any`: the product page in pre-order mode. A pre-order product is out of stock
 *   by definition, so the stock test disabled every option value: the customer could
 *   never pick a size or colour and the Pre-Order link never carried a variant. The
 *   page copes with either answer, switching between Add to Cart and Pre-Order.
 * - `out-of-stock`: the pre-order checkout page, which can ONLY book something that
 *   is unavailable — `createPreOrderService` rejects an in-stock variant with
 *   PRODUCT_AVAILABLE, so offering one there would just produce a failed booking.
 */
export type StockMode = "in-stock" | "any" | "out-of-stock"

export function isVariantSelectable(variant: Variant, mode: StockMode = "in-stock"): boolean {
  if (mode === "any") return true
  return mode === "out-of-stock" ? variant.stock <= 0 : variant.stock > 0
}

/**
 * Whether choosing this value — combined with the other currently-selected axes —
 * still leads to at least one selectable variant under `mode`.
 */
export function isValueAvailable(
  product: Product,
  selection: Selection,
  optionId: string,
  valueId: string,
  opts?: { mode?: StockMode }
): boolean {
  const trial = { ...selection, [optionId]: valueId }
  const selectedIds = Object.values(trial)
  return product.variants.some((v) => {
    const ids = variantValueIds(v)
    const exists = selectedIds.every((id) => ids.has(id))
    return exists && isVariantSelectable(v, opts?.mode)
  })
}
