"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { CategoryService, type CategoryNode } from "../../lib/services/category.service"

// Responsive square tiles sized so an exact whole number fills the row at every
// breakpoint (3 / 4 / 5 / 6 across mobile→desktop), accounting for the gap
// (gap-3 = 12px on mobile, gap-5 = 20px from sm up). No partial tile ever peeks,
// and scroll-snap keeps every rest position aligned to whole tiles.
const TILE_SIZE =
  "shrink-0 snap-start aspect-square basis-[calc((100%-24px)/3)] sm:basis-[calc((100%-60px)/4)] md:basis-[calc((100%-80px)/5)] lg:basis-[calc((100%-100px)/6)]"

function CategoryTile({ cat }: { cat: CategoryNode }) {
  return (
    <Link
      href={`/products/category/${cat.slug}`}
      className={`relative group rounded-xl overflow-hidden ${TILE_SIZE}`}
    >
      {cat.image ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cat.image}
            alt={cat.name}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500"
          />
          <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition" />
          <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 text-white font-semibold text-xs sm:text-sm md:text-base drop-shadow leading-tight">
            {cat.name}
          </div>
        </>
      ) : (
        // Category without an image yet — styled placeholder tile, still a real category.
        <div className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-primary/15 to-primary/5 group-hover:from-primary/25 transition p-3 text-center">
          <span className="text-primary font-semibold text-xs sm:text-sm md:text-base leading-tight">
            {cat.name}
          </span>
        </div>
      )}
    </Link>
  )
}

export default function PromoBannerRow() {
  const [categories, setCategories] = useState<CategoryNode[] | null>(null)
  const [copies, setCopies] = useState(2)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)

  useEffect(() => {
    CategoryService.getAll()
      .then(setCategories)
      .catch(() => setCategories([]))
  }, [])

  // Only real, top-level categories from the API — no static tiles.
  const topLevel = (categories ?? []).filter((c) => !c.parentId)
  const n = topLevel.length
  // Repeat the set enough to overflow the viewport, so the loop is endless.
  const displayCopies = n >= 2 ? copies : 1

  // How many copies are needed to always exceed the viewport (so the wrap has content)?
  useEffect(() => {
    const measure = () => {
      const el = scrollRef.current
      if (!el || n < 2) return
      const rendered = el.children.length / n
      if (!rendered) return
      const oneSet = el.scrollWidth / rendered
      if (oneSet <= 0) return
      const needed = Math.max(2, Math.ceil(el.clientWidth / oneSet) + 1)
      if (needed !== copies) setCopies(needed)
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [categories, copies, n])

  // Infinite auto-scroll: advance exactly ONE tile every 3s; wrap instantly at the seam
  // (one full set later, which is identical content, so the jump is invisible).
  useEffect(() => {
    if (n < 2) return
    const id = setInterval(() => {
      const el = scrollRef.current
      if (!el || pausedRef.current || el.children.length <= n) return
      const step = (el.children[1] as HTMLElement).offsetLeft - (el.children[0] as HTMLElement).offsetLeft
      const seam = (el.children[n] as HTMLElement).offsetLeft // start of the 2nd copy
      let base = el.scrollLeft
      if (base >= seam - 1) {
        base -= seam // instant, seamless wrap (identical content one set back)
        el.scrollLeft = base
      }
      el.scrollTo({ left: base + step, behavior: "smooth" })
    }, 3000)
    return () => clearInterval(id)
  }, [n, copies])

  // Manual arrows move one tile at a time, wrapping at the seam.
  const scrollByTile = (dir: 1 | -1) => {
    const el = scrollRef.current
    if (!el || el.children.length < 2) return
    const step = (el.children[1] as HTMLElement).offsetLeft - (el.children[0] as HTMLElement).offsetLeft
    if (n >= 2 && el.children.length > n) {
      const seam = (el.children[n] as HTMLElement).offsetLeft
      if (dir === -1 && el.scrollLeft <= 0) el.scrollLeft = seam
      else if (dir === 1 && el.scrollLeft >= seam - 1) el.scrollLeft -= seam
    }
    el.scrollBy({ left: dir * step, behavior: "smooth" })
  }

  // Loading: lightweight skeleton tiles to avoid layout jump.
  if (categories === null) {
    return (
      <section>
        <div className="flex items-start justify-center gap-3 sm:gap-5 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`${TILE_SIZE} rounded-xl bg-surface-2 animate-pulse`} />
          ))}
        </div>
      </section>
    )
  }

  if (n === 0) return null

  const tiles = Array.from({ length: displayCopies }).flatMap(() => topLevel)

  return (
    <section className="relative">
      {/* Arrows (desktop) */}
      <button
        type="button"
        aria-label="Previous categories"
        onClick={() => scrollByTile(-1)}
        className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 items-center justify-center rounded-full bg-surface shadow-md border border-border text-muted hover:text-primary hover:shadow-lg transition"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        type="button"
        aria-label="Next categories"
        onClick={() => scrollByTile(1)}
        className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 items-center justify-center rounded-full bg-surface shadow-md border border-border text-muted hover:text-primary hover:shadow-lg transition"
      >
        <ChevronRight size={18} />
      </button>

      <div
        ref={scrollRef}
        onMouseEnter={() => { pausedRef.current = true }}
        onMouseLeave={() => { pausedRef.current = false }}
        onTouchStart={() => { pausedRef.current = true }}
        onTouchEnd={() => { pausedRef.current = false }}
        // `safe center` centers the tiles when they fit, and falls back to a
        // normal left-aligned scroll (never clipping the first tile) when they overflow.
        className="flex items-start justify-center-safe gap-3 sm:gap-5 overflow-x-auto snap-x snap-mandatory pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {tiles.map((cat, i) => (
          <CategoryTile key={`${cat.id}-${i}`} cat={cat} />
        ))}
      </div>
    </section>
  )
}
