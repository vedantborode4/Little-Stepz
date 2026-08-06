"use client"

import Toggle from "../common/Toggle"

export interface SeoValues {
  metaTitle: string
  metaDescription: string
  ogImage: string
  noindex: boolean
  brand?: string
  gtin?: string
  mpn?: string
  condition?: string
}

type Errors = Record<string, string[] | undefined>

const TITLE_MAX = 60
const DESC_MAX = 160

const inputClass =
  "w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-surface"

function Counter({ n, max }: { n: number; max: number }) {
  const cls = n > max ? "text-red-500" : n > max * 0.9 ? "text-amber-500" : "text-faint"
  return <span className={`text-xs ${cls}`}>{n}/{max}</span>
}

/**
 * Reusable per-page SEO editor (plan: SEO panel). Overrides the auto-generated
 * metadata; blank fields fall back to the generated values shown as placeholders
 * + in the Google preview. `showMerchant` adds the Product/Shopping identity
 * fields (products only).
 */
export default function SeoPanel({
  values,
  onChange,
  errors = {},
  previewPath,
  fallbackTitle,
  fallbackDescription,
  showMerchant = false,
}: {
  values: SeoValues
  onChange: (key: keyof SeoValues, value: string | boolean) => void
  errors?: Errors
  previewPath: string
  fallbackTitle: string
  fallbackDescription: string
  showMerchant?: boolean
}) {
  const title = values.metaTitle || fallbackTitle
  const desc = values.metaDescription || fallbackDescription

  return (
    <div className="pt-4 border-t border-border space-y-4">
      <div>
        <h3 className="font-semibold text-text text-sm">Search Engine Optimization</h3>
        <p className="text-xs text-faint mt-0.5">
          Overrides what Google &amp; social shows. Leave blank to use the auto-generated values.
        </p>
      </div>

      {/* Google result preview */}
      <div className="rounded-xl border border-border bg-surface-2 p-3.5 space-y-0.5">
        <p className="text-[11px] text-faint">Google preview</p>
        <p className="text-[12px] text-emerald-700 dark:text-emerald-400 truncate">
          littlestepz.in › {previewPath}
        </p>
        <p className="text-[17px] leading-snug text-blue-800 dark:text-blue-400 truncate">
          {title || "—"}
        </p>
        <p className="text-[13px] text-muted line-clamp-2">{desc || "—"}</p>
      </div>

      {/* Meta title */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-muted">Meta title</label>
          <Counter n={values.metaTitle.length} max={TITLE_MAX} />
        </div>
        <input
          className={inputClass}
          value={values.metaTitle}
          onChange={(e) => onChange("metaTitle", e.target.value)}
          placeholder={fallbackTitle}
        />
        {errors.metaTitle?.[0] && <p className="text-xs text-red-500 dark:text-red-400">{errors.metaTitle[0]}</p>}
      </div>

      {/* Meta description */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-muted">Meta description</label>
          <Counter n={values.metaDescription.length} max={DESC_MAX} />
        </div>
        <textarea
          className={`${inputClass} min-h-[80px] resize-none`}
          value={values.metaDescription}
          onChange={(e) => onChange("metaDescription", e.target.value)}
          placeholder={fallbackDescription}
        />
        {errors.metaDescription?.[0] && <p className="text-xs text-red-500 dark:text-red-400">{errors.metaDescription[0]}</p>}
      </div>

      {/* OG / social image */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-muted">Social share image URL (optional)</label>
        <input
          className={inputClass}
          value={values.ogImage}
          onChange={(e) => onChange("ogImage", e.target.value)}
          placeholder="https://…  (defaults to the first image)"
        />
        {errors.ogImage?.[0] && <p className="text-xs text-red-500 dark:text-red-400">{errors.ogImage[0]}</p>}
      </div>

      {/* Show in Google & sitemap */}
      <div className="flex items-center gap-3">
        <Toggle checked={!values.noindex} onChange={(on) => onChange("noindex", !on)} />
        <div>
          <p className="text-sm font-medium text-muted">Show in Google &amp; sitemap</p>
          <p className="text-xs text-faint">Off adds a noindex tag and removes this page from the sitemap.</p>
        </div>
      </div>

      {showMerchant && (
        <div className="pt-4 border-t border-border space-y-4">
          <div>
            <h3 className="font-semibold text-text text-sm">Google Shopping / product identity</h3>
            <p className="text-xs text-faint mt-0.5">Used in the Merchant feed and Product rich results.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-muted">Brand</label>
              <input className={inputClass} value={values.brand ?? ""} onChange={(e) => onChange("brand", e.target.value)} placeholder="e.g. Ferrari" />
              {errors.brand?.[0] && <p className="text-xs text-red-500 dark:text-red-400">{errors.brand[0]}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-muted">Condition</label>
              <select className={inputClass} value={values.condition || "new"} onChange={(e) => onChange("condition", e.target.value)}>
                <option value="new">New</option>
                <option value="refurbished">Refurbished</option>
                <option value="used">Used</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-muted">GTIN (barcode)</label>
              <input className={inputClass} value={values.gtin ?? ""} onChange={(e) => onChange("gtin", e.target.value)} placeholder="EAN / UPC / ISBN" />
              {errors.gtin?.[0] && <p className="text-xs text-red-500 dark:text-red-400">{errors.gtin[0]}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-muted">MPN</label>
              <input className={inputClass} value={values.mpn ?? ""} onChange={(e) => onChange("mpn", e.target.value)} placeholder="Manufacturer part number" />
              {errors.mpn?.[0] && <p className="text-xs text-red-500 dark:text-red-400">{errors.mpn[0]}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
