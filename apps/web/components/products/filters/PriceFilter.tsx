"use client"

import { useEffect, useState } from "react"
import { useProductFilterStore } from "../../../store/useProductFilterStore"

const MIN = 0
const MAX = 50000
const STEP = 100

export default function PriceFilter() {
  const draftMin = useProductFilterStore((s) => s.draftPriceMin)
  const draftMax = useProductFilterStore((s) => s.draftPriceMax)
  const setDraft = useProductFilterStore((s) => s.setDraft)

  const [localMin, setLocalMin] = useState(draftMin ?? MIN)
  const [localMax, setLocalMax] = useState(draftMax ?? MAX)

  // Sync draft → local (e.g. after Apply / Clear / URL hydration)
  useEffect(() => { setLocalMin(draftMin ?? MIN) }, [draftMin])
  useEffect(() => { setLocalMax(draftMax ?? MAX) }, [draftMax])

  // Write to the draft only — nothing refetches until the user hits "Apply".
  const commitDraft = (min: number, max: number) => {
    setDraft({
      draftPriceMin: min > MIN ? min : undefined,
      draftPriceMax: max < MAX ? max : undefined,
    })
  }

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.min(Number(e.target.value), localMax - STEP)
    setLocalMin(val)
    commitDraft(val, localMax)
  }

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.max(Number(e.target.value), localMin + STEP)
    setLocalMax(val)
    commitDraft(localMin, val)
  }

  const minPct = ((localMin - MIN) / (MAX - MIN)) * 100
  const maxPct = ((localMax - MIN) / (MAX - MIN)) * 100

  return (
    <div className="space-y-4">
      {/* Track + dual thumbs */}
      <div className="relative h-5 flex items-center">
        {/* Background track */}
        <div className="absolute w-full h-1.5 bg-surface-3 rounded-full" />
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
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-faint">₹</span>
          <input
            type="number"
            min={MIN} max={localMax - STEP} step={STEP}
            value={localMin}
            onChange={handleMinChange}
            className="w-full pl-6 pr-2 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <span className="text-faint text-xs">—</span>
        <div className="flex-1 relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-faint">₹</span>
          <input
            type="number"
            min={localMin + STEP} max={MAX} step={STEP}
            value={localMax}
            onChange={handleMaxChange}
            className="w-full pl-6 pr-2 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Labels */}
      <div className="flex justify-between text-xs text-faint">
        <span>Min</span>
        <span className="text-primary font-medium">
          ₹{localMin.toLocaleString()} – ₹{localMax.toLocaleString()}
        </span>
        <span>Max</span>
      </div>
    </div>
  )
}
