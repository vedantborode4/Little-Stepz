"use client"

import { Check } from "lucide-react"
import type { Product } from "../../../types/product"
import { isValueAvailable, type Selection, type StockMode } from "../../../lib/variants/matrix"

const isColorAxis = (name: string) => ["color", "colour"].includes(name.trim().toLowerCase())

export default function OptionSelector({
  product,
  selection,
  onSelect,
  disabled,
  stockMode,
}: {
  product: Product
  selection: Selection
  onSelect: (optionId: string, valueId: string) => void
  disabled?: boolean
  /** Which variants count as selectable — see StockMode. */
  stockMode?: StockMode
}) {
  const options = product.options ?? []
  if (!options.length) return null

  return (
    <div className="space-y-4">
      {options.map((opt) => {
        const color = isColorAxis(opt.name)
        return (
          <div key={opt.id} className="space-y-2">
            <p className="text-sm font-semibold text-muted">
              {opt.name}
              {selection[opt.id] && (
                <span className="ml-1.5 font-normal text-faint">
                  {opt.values.find((v) => v.id === selection[opt.id])?.value}
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {opt.values.map((val) => {
                const active = selection[opt.id] === val.id
                const available =
                  active || isValueAvailable(product, selection, opt.id, val.id, { mode: stockMode })

                if (color && val.swatchHex) {
                  return (
                    <button
                      key={val.id}
                      type="button"
                      title={val.value}
                      disabled={disabled || !available}
                      onClick={() => onSelect(opt.id, val.id)}
                      className={`relative w-9 h-9 rounded-full border-2 transition ${
                        active ? "border-primary" : "border-border"
                      } ${!available ? "opacity-30 cursor-not-allowed" : ""}`}
                      style={{ backgroundColor: val.swatchHex }}
                    >
                      {active && (
                        <Check size={14} className="absolute inset-0 m-auto text-white drop-shadow" />
                      )}
                    </button>
                  )
                }

                return (
                  <button
                    key={val.id}
                    type="button"
                    disabled={disabled || !available}
                    onClick={() => onSelect(opt.id, val.id)}
                    className={`px-4 py-2 border rounded-xl text-sm font-medium transition-all ${
                      active
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-border text-muted hover:border-primary hover:text-primary"
                    } ${!available ? "opacity-30 line-through cursor-not-allowed" : ""}`}
                  >
                    {val.value}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
