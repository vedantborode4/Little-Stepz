import type { Product, Variant } from "../../types/product";

/** optionId -> selected valueId */
export type Selection = Record<string, string>;

const variantValueIds = (v: Variant): Set<string> =>
  new Set((v.optionValues ?? []).map((o) => o.optionValueId));

const stockOf = (v: Variant): number => (v.stock ?? 0);

export function isSelectionComplete(product: Product, selection: Selection): boolean {
  const opts = product.options ?? [];
  return opts.length > 0 && opts.every((o) => selection[o.id]);
}

/** The variant whose option-value set exactly matches a complete selection. */
export function findVariant(product: Product, selection: Selection): Variant | undefined {
  if (!isSelectionComplete(product, selection)) return undefined;
  const wanted = Object.values(selection);
  return (product.variants ?? []).find((v) => {
    const ids = variantValueIds(v);
    return ids.size === wanted.length && wanted.every((id) => ids.has(id));
  });
}

/**
 * Whether choosing this value — combined with the other currently-selected axes —
 * still leads to at least one in-stock variant. Drives disabling impossible/OOS combos.
 */
export function isValueAvailable(
  product: Product,
  selection: Selection,
  optionId: string,
  valueId: string,
  opts?: { ignoreStock?: boolean }
): boolean {
  const trial = { ...selection, [optionId]: valueId };
  const selectedIds = Object.values(trial);
  return (product.variants ?? []).some((v) => {
    const ids = variantValueIds(v);
    const exists = selectedIds.every((id) => ids.has(id));
    // ignoreStock is for pre-orders: the product is out of stock by definition, so
    // the stock test would disable every option and make the axes unusable.
    return exists && (opts?.ignoreStock || stockOf(v) > 0);
  });
}
