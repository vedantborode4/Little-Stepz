/** Pure helpers for building a product's variant rows from its options. */

export interface OptionDraft {
  name: string
  values: string[]
}

export interface VariantDraft {
  sku: string
  optionValues: string[]
  regularPrice: string
  offerPrice: string
  wholesalePrice: string
  reorderLevel: number
}

export const emptyVariant = (optionValues: string[] = []): VariantDraft => ({
  sku: "",
  optionValues,
  regularPrice: "",
  offerPrice: "",
  wholesalePrice: "",
  reorderLevel: 0,
})

export const comboKey = (values: string[]) => values.map((v) => v.trim().toLowerCase()).join("|")

/** Every combination of the options' values, in option order (Colour × Size → Red/S, Red/M, …). */
export function cartesian(options: OptionDraft[]): string[][] {
  const usable = options.filter((o) => o.values.length > 0)
  if (usable.length === 0) return []
  return usable.reduce<string[][]>((acc, option) => acc.flatMap((combo) => option.values.map((v) => [...combo, v])), [[]])
}

/** New rows for the current options, keeping whatever the user already typed for combinations that still exist. */
export function syncVariants(options: OptionDraft[], current: VariantDraft[]): VariantDraft[] {
  const existing = new Map(current.map((v) => [comboKey(v.optionValues), v]))
  return cartesian(options).map((combo) => existing.get(comboKey(combo)) ?? emptyVariant(combo))
}

/** SKU from a prefix and the variant's values: "YG64" + ["Rose Quartz"] → "YG64-ROSE-QUARTZ". */
export function suggestSku(prefix: string, values: string[]) {
  const part = (s: string) =>
    s
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  return [part(prefix), ...values.map(part)].filter(Boolean).join("-").slice(0, 40)
}
