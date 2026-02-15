"use client"

import { useEffect, useState } from "react"
import { useProductFilterStore } from "../../../store/useProductFilterStore"

export default function PriceFilter() {
  const priceMax = useProductFilterStore((s) => s.priceMax)
  const setFilters = useProductFilterStore((s) => s.setFilters)

  const [localValue, setLocalValue] = useState(priceMax ?? 5000)

  // debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters({ priceMax: localValue })
    }, 500)

    return () => clearTimeout(timer)
  }, [localValue, setFilters])

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-text">Price Range</h3>

      <input
        type="range"
        min={0}
        max={50000}
        step={100}
        value={localValue}
        onChange={(e) => setLocalValue(Number(e.target.value))}
        className="w-full accent-primary cursor-pointer"
      />

      <div className="flex justify-between text-sm text-muted font-medium">
        <span>₹0</span>
        <span className="text-primary font-semibold">
          ₹{localValue.toLocaleString()}
        </span>
      </div>
    </div>
  )
}
