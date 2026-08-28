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
/**
 * Which variants count as selectable. Mirrors apps/web/lib/variants/matrix.ts.
 *
 * - `in-stock` (default): normal buying.
 * - `any`: the product screen in pre-order mode — a pre-order product has no stock,
 *   so the stock test would disable every option and make the axes unusable.
 * - `out-of-stock`: the pre-order screen, which can only book something unavailable;
 *   the server rejects an in-stock variant with PRODUCT_AVAILABLE.
 */
export type StockMode = "in-stock" | "any" | "out-of-stock";

export function isVariantSelectable(variant: Variant, mode: StockMode = "in-stock"): boolean {
  if (mode === "any") return true;
  return mode === "out-of-stock" ? stockOf(variant) <= 0 : stockOf(variant) > 0;
}

export function isValueAvailable(
  product: Product,
  selection: Selection,
  optionId: string,
  valueId: string,
  opts?: { mode?: StockMode }
): boolean {
  const trial = { ...selection, [optionId]: valueId };
  const selectedIds = Object.values(trial);
  return (product.variants ?? []).some((v) => {
    const ids = variantValueIds(v);
    const exists = selectedIds.every((id) => ids.has(id));
    return exists && isVariantSelectable(v, opts?.mode);
  });
}
