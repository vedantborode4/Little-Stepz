"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ProductService } from "../../lib/services/product.service"
import ProductSlider from "./ProductSlider"
import ProductGrid, { ProductGridSkeleton } from "./ProductGrid"
import SectionHeader from "./SectionHeader"
import type { Product } from "../../types/product"

interface Props {
  slug: string
  title: string
  subtitle?: string
  limit?: number
  /** "grid" = static responsive grid; "slider" = horizontal carousel. */
  layout?: "grid" | "slider"
  /** Visible columns for the slider layout (desktop). */
  columns?: 2 | 3 | 4
}

// Per-item widths so an exact whole number of cards fills the slider (no partial peek).
const SLIDER_BASIS: Record<number, string> = {
  2: "basis-full sm:basis-[calc(50%-10px)]",
  3: "basis-[calc(50%-6px)] sm:basis-[calc(33.333%-13.333px)]",
  4: "basis-[calc(50%-6px)] sm:basis-[calc(33.333%-13.333px)] lg:basis-[calc(25%-15px)]",
}

/** A homepage section showing a category's products as a slider or grid. Hides itself when empty. */
export default function CategorySection({ slug, title, subtitle, limit = 12, layout = "slider", columns = 2 }: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ProductService.getByCategorySlug(slug, 1, limit)
      .then((res) => setProducts(res.data.slice(0, limit)))
      .catch((err) => {
        // Never swallow this: a mis-typed slug otherwise kills the whole
        // merchandising section silently on every page load.
        const status = err?.response?.status
        const reason = err?.response?.data?.message ?? err?.message ?? "unknown error"
        console.error(
          status === 404
            ? `[CategorySection] Category slug "${slug}" does not exist (404). The section will not render.`
            : `[CategorySection] Failed to load category "${slug}"${status ? ` (HTTP ${status})` : ""}: ${reason}`
        )
      })
      .finally(() => setLoading(false))
  }, [slug, limit])

  // Nothing to show → hide the whole section.
  if (!loading && products.length === 0) return null

  const isGrid = layout === "grid"
  // The 2-up slider has big cards — constrain its width on tablet/desktop so they
  // aren't oversized. The grid and 3/4-up sliders use the full section width.
  const wrapperClass = !isGrid && columns === 2 ? "md:px-12 lg:px-28 xl:px-44" : ""

  return (
    <section>
      {/* Shared centered heading (Anton) — consistent with every other homepage section. */}
      <SectionHeader title={title} subtitle={subtitle} />

      <div className={wrapperClass}>
        {loading ? (
          isGrid ? (
            <ProductGridSkeleton count={Math.min(limit, 8)} />
          ) : (
            <div className="flex gap-3 sm:gap-5">
              {Array.from({ length: columns }).map((_, i) => (
                <div key={i} className={`${SLIDER_BASIS[columns]} shrink-0 bg-surface border border-border rounded-2xl overflow-hidden animate-pulse`}>
                  <div className="aspect-square bg-surface-2" />
                  <div className="p-3 sm:p-4 space-y-2">
                    <div className="h-4 bg-surface-3 rounded" />
                    <div className="h-4 w-2/3 bg-surface-2 rounded" />
                    <div className="h-9 bg-surface-2 rounded-xl mt-2" />
                  </div>
                </div>
              ))}
            </div>
          )
        ) : isGrid ? (
          <ProductGrid products={products} />
        ) : (
          <ProductSlider products={products} itemClassName={SLIDER_BASIS[columns]} />
        )}
      </div>

      {/* View All — below the cards, centered */}
      <div className="flex justify-center mt-6">
        <Link
          href={`/products/category/${slug}`}
          className="text-md font-medium text-primary hover:underline"
        >
          View All {title} →
        </Link>
      </div>
    </section>
  )
}
