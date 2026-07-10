"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import ProductCard from "../products/ProductCard"
import type { Product } from "../../types/product"

interface Props {
  products: Product[]
  /** Per-item responsive basis controlling how many cards are visible per view. */
  itemClassName?: string
  /** Auto-advance interval in ms (0 disables autoplay). */
  interval?: number
}

/**
 * Horizontal product carousel: auto-slides, swipe/scroll on touch, arrow buttons on desktop.
 * Scroll-snaps to each card. The track gets vertical padding so the cards' hover scale/shadow
 * isn't clipped by the horizontal-scroll container.
 */
export default function ProductSlider({
  products,
  itemClassName = "basis-[46%] sm:basis-[31.5%] lg:basis-[23.5%]",
  interval = 6000,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)

  const scrollByView = (dir: 1 | -1) => {
    const el = ref.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" })
  }

  // Auto-advance one card at a time, looping back to the start at the end.
  useEffect(() => {
    if (!interval || products.length < 2) return
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return

    const id = window.setInterval(() => {
      if (paused) return
      const el = ref.current
      if (!el) return
      const maxScroll = el.scrollWidth - el.clientWidth
      if (maxScroll <= 0) return
      if (el.scrollLeft >= maxScroll - 8) {
        el.scrollTo({ left: 0, behavior: "smooth" })
      } else {
        const first = el.firstElementChild as HTMLElement | null
        const step = first ? first.offsetWidth + 20 : el.clientWidth * 0.9
        el.scrollBy({ left: step, behavior: "smooth" })
      }
    }, interval)

    return () => window.clearInterval(id)
  }, [interval, paused, products.length])

  return (
    <div
      className="relative group/slider"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        ref={ref}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => window.setTimeout(() => setPaused(false), 4000)}
        className="flex gap-3 sm:gap-5 overflow-x-auto scrollbar-none snap-x snap-mandatory scroll-smooth -mx-4 px-4 py-6"
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
        aria-label="Previous products"
        onClick={() => scrollByView(-1)}
        className="hidden lg:flex absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-surface shadow-lg border border-border text-muted hover:text-primary hover:border-primary/30 opacity-0 group-hover/slider:opacity-100 group-focus-within/slider:opacity-100 focus-visible:opacity-100 transition"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        type="button"
        aria-label="Next products"
        onClick={() => scrollByView(1)}
        className="hidden lg:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-surface shadow-lg border border-border text-muted hover:text-primary hover:border-primary/30 opacity-0 group-hover/slider:opacity-100 group-focus-within/slider:opacity-100 focus-visible:opacity-100 transition"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  )
}
