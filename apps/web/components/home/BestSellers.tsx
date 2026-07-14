"use client"

import { useEffect, useState } from "react"
import { ProductService } from "../../lib/services/product.service"
import ProductSlider from "./ProductSlider"
import ProductGrid, { ProductGridSkeleton } from "./ProductGrid"
import type { Product } from "../../types/product"

interface Props {
  sort?: string
  limit?: number
  showViewAll?: boolean
  /** "grid" = static responsive grid (2/3/4 cols); "slider" = horizontal carousel. */
  layout?: "grid" | "slider"
}

export default function BestSellers({ sort = "newest", limit = 12, showViewAll = true, layout = "slider" }: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await ProductService.getProducts({ limit, sort })
        setProducts(res.data.slice(0, limit))
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [sort, limit])

  return (
    <section>
      {loading ? (
        layout === "grid" ? (
          <ProductGridSkeleton count={Math.min(limit, 8)} />
        ) : (
          <div className="flex gap-3 sm:gap-5 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="basis-[calc(50%-6px)] sm:basis-[calc(33.333%-13.333px)] lg:basis-[calc(25%-15px)] shrink-0 bg-surface border border-border rounded-2xl overflow-hidden animate-pulse">
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
      ) : layout === "grid" ? (
        <ProductGrid products={products} />
      ) : (
        <ProductSlider products={products} />
      )}

      {showViewAll && (
        <div className="flex items-center justify-center gap-4 mb-6">
          <a href="/products" className="text-md font-medium text-primary hover:underline mt-6">
            View All →
          </a>
        </div>
      )}
    </section>
  )
}
