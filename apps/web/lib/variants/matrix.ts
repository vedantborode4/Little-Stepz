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
 * Whether choosing this value — combined with the other currently-selected axes —
 * still leads to at least one in-stock variant. Drives disabling impossible/OOS combos.
 *
 * `ignoreStock` exists for pre-orders. A pre-order product is out of stock by
 * definition, so the stock test disabled every option value on it: the customer
 * could never pick a size or colour, and the Pre-Order link never carried a
 * variant. Booking is a claim on future stock, so availability there is only about
 * whether the combination exists at all.
 */
export function isValueAvailable(
  product: Product,
  selection: Selection,
  optionId: string,
  valueId: string,
  opts?: { ignoreStock?: boolean }
): boolean {
  const trial = { ...selection, [optionId]: valueId }
  const selectedIds = Object.values(trial)
  return product.variants.some((v) => {
    const ids = variantValueIds(v)
    const exists = selectedIds.every((id) => ids.has(id))
    return exists && (opts?.ignoreStock || v.stock > 0)
  })
}
