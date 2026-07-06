"use client"

import { useRef } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import ProductCard from "../products/ProductCard"
import type { Product } from "../../types/product"

interface Props {
  products: Product[]
  /** Per-item responsive basis controlling how many cards are visible per view. */
  itemClassName?: string
}

/**
 * Horizontal product carousel: swipe/scroll on touch, arrow buttons on desktop.
 * Scroll-snaps to each card and hides the scrollbar.
 */
export default function ProductSlider({
  products,
  itemClassName = "basis-[46%] sm:basis-[31.5%] lg:basis-[23.5%]",
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  const scrollByView = (dir: 1 | -1) => {
    const el = ref.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" })
  }

  return (
    <div className="relative group/slider">
      <div
        ref={ref}
        className="flex gap-3 sm:gap-5 overflow-x-auto scrollbar-none snap-x snap-mandatory scroll-smooth pb-1"
      >
        {products.map((p) => (
          <div key={p.id} className={`shrink-0 snap-start ${itemClassName}`}>
            <ProductCard product={p} />
          </div>
        ))}
      </div>

      {/* Arrows — desktop only, appear on hover */}
      <button
        type="button"
        aria-label="Previous"
        onClick={() => scrollByView(-1)}
        className="hidden lg:flex absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-white shadow-lg border border-gray-100 text-gray-600 hover:text-primary hover:border-primary/30 opacity-0 group-hover/slider:opacity-100 transition"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        type="button"
        aria-label="Next"
        onClick={() => scrollByView(1)}
        className="hidden lg:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-white shadow-lg border border-gray-100 text-gray-600 hover:text-primary hover:border-primary/30 opacity-0 group-hover/slider:opacity-100 transition"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  )
}
