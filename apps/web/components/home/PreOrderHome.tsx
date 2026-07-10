"use client"

import { useEffect, useState } from "react"
import { ProductService } from "../../lib/services/product.service"
import ProductSlider from "./ProductSlider"
import SectionHeader from "./SectionHeader"
import type { Product } from "../../types/product"

export default function PreOrderHome({ limit = 12 }: { limit?: number }) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await ProductService.getProducts({ limit, sort: "newest", preOrder: true })
        setProducts(res.data.slice(0, limit))
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [limit])

  // Hide the whole section when there's nothing to pre-order.
  if (!loading && products.length === 0) return null

  return (
    <section className="max-w-7xl mx-auto px-4 py-8 sm:py-12">
      <SectionHeader title="Pre-Order Now" subtitle="Reserve upcoming & out-of-stock arrivals" />

      <div className="md:px-12 lg:px-28 xl:px-44">
        {loading ? (
          <div className="flex gap-3 sm:gap-5">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="basis-full sm:basis-[calc(50%-10px)] shrink-0 bg-surface border border-border rounded-2xl overflow-hidden animate-pulse">
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
          <ProductSlider products={products} itemClassName="basis-full sm:basis-[calc(50%-10px)]" />
        )}
      </div>

      <div className="flex items-center justify-center gap-4 mb-6">
        <a href="/pre-orders" className="text-md font-medium text-primary hover:underline mt-6">
          View All Pre-Orders →
        </a>
      </div>
    </section>
  )
}
