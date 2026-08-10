"use client"

import { useEffect, useState } from "react"
import { ProductService } from "../../../lib/services/product.service"
import ProductCard from "../ProductCard"
import type { Product } from "../../../types/product"
import { Sparkles } from "lucide-react"

export default function SimilarProducts({
  categorySlug,
  excludeId,
}: {
  categorySlug: string
  excludeId?: string
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        // `category` is resolved server-side as a category SLUG. This used to be
        // handed the category *id*, which matched no slug, so the filter was
        // dropped and this section showed the newest products in the whole
        // catalogue instead of related ones.
        // Fetch one extra so removing the current product still leaves 4.
        const res = await ProductService.getProducts({ category: categorySlug, limit: 5 })
        setProducts(res.data.filter((p) => p.id !== excludeId).slice(0, 4))
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [categorySlug, excludeId])

  if (!loading && !products.length) return null

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-xl">
          <Sparkles size={16} className="text-primary" />
        </div>
        <div>
          <h2 className="font-anton text-xl uppercase tracking-wide text-text">You May Also Like</h2>
          <p className="text-xs text-faint mt-0.5">From the same category</p>
        </div>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {[1,2,3,4].map((i) => (
            <div key={i} className="bg-surface border border-border rounded-2xl overflow-hidden animate-pulse">
              <div className="aspect-square bg-surface-2" />
              <div className="p-4 space-y-2.5">
                <div className="h-3 bg-surface-2 rounded-full w-3/4" />
                <div className="h-3 bg-surface-2 rounded-full w-1/2" />
                <div className="h-9 bg-surface-2 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  )
}
