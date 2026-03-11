"use client"

import { useEffect, useState } from "react"
import { useProductFilterStore } from "../../../store/useProductFilterStore"

const MIN = 0
const MAX = 50000
const STEP = 100

export default function PriceFilter() {
  const priceMin = useProductFilterStore((s) => s.priceMin)
  const priceMax = useProductFilterStore((s) => s.priceMax)

  const [localMin, setLocalMin] = useState(priceMin ?? MIN)
  const [localMax, setLocalMax] = useState(priceMax ?? MAX)

  // Sync store → local when external reset happens
  useEffect(() => { setLocalMin(priceMin ?? MIN) }, [priceMin])
  useEffect(() => { setLocalMax(priceMax ?? MAX) }, [priceMax])

  // Debounce store updates
  useEffect(() => {
    const t = setTimeout(() => {
      useProductFilterStore.getState().setFilters({
        priceMin: localMin > MIN ? localMin : undefined,
        priceMax: localMax < MAX ? localMax : undefined,
        page: 1,
      })
    }, 400)
    return () => clearTimeout(t)
  }, [localMin, localMax])

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.min(Number(e.target.value), localMax - STEP)
    setLocalMin(val)
  }

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.max(Number(e.target.value), localMin + STEP)
    setLocalMax(val)
  }

  const minPct = ((localMin - MIN) / (MAX - MIN)) * 100
  const maxPct = ((localMax - MIN) / (MAX - MIN)) * 100

  return (
    <div className="space-y-4">
      {/* Track + dual thumbs */}
      <div className="relative h-5 flex items-center">
        {/* Background track */}
        <div className="absolute w-full h-1.5 bg-gray-200 rounded-full" />
        {/* Active range */}
        <div
          className="absolute h-1.5 bg-primary rounded-full"
          style={{ left: `${minPct}%`, right: `${100 - maxPct}%` }}
        />
        {/* Min thumb */}
        <input
          type="range"
          min={MIN} max={MAX} step={STEP}
          value={localMin}
          onChange={handleMinChange}
          className="absolute w-full appearance-none bg-transparent pointer-events-none
            [&::-webkit-slider-thumb]:pointer-events-auto
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary
            [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white
            [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer
            [&::-moz-range-thumb]:pointer-events-auto
            [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4
            [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary
            [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:cursor-pointer"
        />
        {/* Max thumb */}
        <input
          type="range"
          min={MIN} max={MAX} step={STEP}
          value={localMax}
          onChange={handleMaxChange}
          className="absolute w-full appearance-none bg-transparent pointer-events-none
            [&::-webkit-slider-thumb]:pointer-events-auto
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary
            [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white
            [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer
            [&::-moz-range-thumb]:pointer-events-auto
            [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4
            [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary
            [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:cursor-pointer"
        />
      </div>

      {/* Number inputs */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">₹</span>
          <input
            type="number"
            min={MIN} max={localMax - STEP} step={STEP}
            value={localMin}
            onChange={(e) => setLocalMin(Math.min(Number(e.target.value), localMax - STEP))}
            className="w-full pl-6 pr-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <span className="text-gray-300 text-xs">—</span>
        <div className="flex-1 relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">₹</span>
          <input
            type="number"
            min={localMin + STEP} max={MAX} step={STEP}
            value={localMax}
            onChange={(e) => setLocalMax(Math.max(Number(e.target.value), localMin + STEP))}
            className="w-full pl-6 pr-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Labels */}
      <div className="flex justify-between text-xs text-gray-400">
        <span>Min</span>
        <span className="text-primary font-medium">
          ₹{localMin.toLocaleString()} – ₹{localMax.toLocaleString()}
        </span>
        <span>Max</span>
      </div>
    </div>
  )
}
