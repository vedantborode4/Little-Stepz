"use client"

import { useRef } from "react"
import Toggle from "../../common/Toggle"

export interface VariantFormValue {
  name: string
  sku: string
  price: string
  salePrice: string
  isOnSale: boolean
  stock: string
  /** Pre-order terms for this variant. The product-level switch is the master —
   *  this can only opt the variant out. Blank booking/limit inherit the product. */
  preOrderEnabled: boolean
  bookingAmount: string
  preOrderLimit: string
}

const priceGuard = (v: string) => v === "" || /^\d*\.?\d{0,2}$/.test(v)
const intGuard = (v: string) => v === "" || /^\d+$/.test(v)

const inputCls =
  "w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-surface"

/**
 * Presentational field block for a single variant (name / sku / prices / stock).
 * Shared by both the "add new" draft rows and the existing-variant rows.
 */
export default function VariantRow({
  value,
  onChange,
  disabled,
  productPreOrderEnabled,
  productBookingAmount,
}: {
  value: VariantFormValue
  onChange: (patch: Partial<VariantFormValue>) => void
  disabled?: boolean
  /** Pre-order controls only make sense once the product allows pre-orders. */
  productPreOrderEnabled?: boolean
  /** Shown as the placeholder, so "blank = inherit" is visible rather than implied. */
  productBookingAmount?: string
}) {
  // Remembers the last positive stock so flipping "in stock" back on restores it.
  const lastStockRef = useRef("1")
  const stockNum = Number(value.stock || 0)
  const toggleStock = (inStock: boolean) => {
    if (inStock) {
      onChange({ stock: stockNum > 0 ? value.stock : (Number(lastStockRef.current) > 0 ? lastStockRef.current : "1") })
    } else {
      if (stockNum > 0) lastStockRef.current = value.stock
      onChange({ stock: "0" })
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        <input
          className={`${inputCls} col-span-2`}
          placeholder="Variant name"
          value={value.name}
          disabled={disabled}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <input
          className={inputCls}
          placeholder="SKU (optional)"
          value={value.sku}
          disabled={disabled}
          onChange={(e) => onChange({ sku: e.target.value })}
        />
        <input
          className={inputCls}
          type="text"
          inputMode="decimal"
          placeholder="Regular price"
          value={value.price}
          disabled={disabled}
          onChange={(e) => { if (priceGuard(e.target.value)) onChange({ price: e.target.value }) }}
        />
        <input
          className={inputCls}
          type="text"
          inputMode="decimal"
          placeholder="Sale price"
          value={value.salePrice}
          disabled={disabled}
          onChange={(e) => { if (priceGuard(e.target.value)) onChange({ salePrice: e.target.value }) }}
        />
        <input
          className={inputCls}
          type="text"
          inputMode="numeric"
          placeholder="Stock"
          value={value.stock}
          disabled={disabled}
          onChange={(e) => { if (intGuard(e.target.value)) onChange({ stock: e.target.value }) }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Toggle checked={stockNum > 0} onChange={toggleStock} disabled={disabled} />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={value.isOnSale}
            disabled={disabled}
            onChange={(e) => onChange({ isOnSale: e.target.checked })}
            className="w-4 h-4 rounded accent-primary"
          />
          On sale — charge this variant&apos;s sale price
        </label>
      </div>

      {/* Pre-order — only meaningful when the product itself allows pre-orders. */}
      {productPreOrderEnabled && (
        <div className="rounded-xl border border-border bg-surface-2/50 p-3 space-y-3">
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={value.preOrderEnabled}
              disabled={disabled}
              onChange={(e) => onChange({ preOrderEnabled: e.target.checked })}
              className="w-4 h-4 rounded accent-primary"
            />
            Allow pre-orders for this variant
          </label>

          {value.preOrderEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
              <label className="space-y-1">
                <span className="text-xs font-medium text-faint">Booking amount (₹)</span>
                <input
                  className={inputCls}
                  inputMode="decimal"
                  placeholder={productBookingAmount ? `${productBookingAmount} (product)` : "Same as product"}
                  value={value.bookingAmount}
                  disabled={disabled}
                  onChange={(e) => { if (priceGuard(e.target.value)) onChange({ bookingAmount: e.target.value }) }}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-faint">Pre-order limit</span>
                <input
                  className={inputCls}
                  inputMode="numeric"
                  placeholder="Product limit only"
                  value={value.preOrderLimit}
                  disabled={disabled}
                  onChange={(e) => { if (intGuard(e.target.value)) onChange({ preOrderLimit: e.target.value }) }}
                />
              </label>
              <p className="sm:col-span-2 text-[11px] text-faint">
                Leave blank to use the product&apos;s booking amount. A limit here caps this
                variant alone — the product limit still applies as the overall total.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
