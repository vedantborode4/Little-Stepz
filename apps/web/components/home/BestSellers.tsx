"use client"

import { useEffect, useState } from "react"
import { ProductService } from "../../lib/services/product.service"
import ProductSlider from "./ProductSlider"
import type { Product } from "../../types/product"

interface Props {
  sort?: string
  limit?: number
  showViewAll?: boolean
}

export default function BestSellers({ sort = "newest", limit = 12, showViewAll = true }: Props) {
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
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-none pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0 sm:overflow-visible sm:grid sm:grid-cols-3 lg:grid-cols-5 sm:gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="basis-[46%] min-w-0 shrink-0 snap-start sm:basis-auto bg-surface border border-border rounded-2xl overflow-hidden animate-pulse">
              <div className="aspect-square bg-surface-2" />
              <div className="p-3 sm:p-4 space-y-2">
                <div className="h-4 bg-surface-3 rounded" />
                <div className="h-4 w-2/3 bg-surface-2 rounded" />
                <div className="h-9 bg-surface-2 rounded-xl mt-2" />
              </div>
            </div>
          ))}
        </div>
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
