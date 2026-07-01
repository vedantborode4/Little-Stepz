"use client"

import { useEffect, useState } from "react"
import { ProductService } from "../../lib/services/product.service"
import ProductCard from "../products/ProductCard"
import SectionHeader from "./SectionHeader"
import type { Product } from "../../types/product"

export default function PreOrderHome({ limit = 5 }: { limit?: number }) {
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

      {loading ? (
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-none pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0 sm:overflow-visible sm:grid sm:grid-cols-3 lg:grid-cols-5 sm:gap-4">
          {Array.from({ length: limit }).map((_, i) => (
            <div key={i} className="basis-[46%] min-w-0 shrink-0 snap-start sm:basis-auto bg-white border border-gray-200 rounded-2xl overflow-hidden animate-pulse">
              <div className="aspect-square bg-gray-100" />
              <div className="p-3 sm:p-4 space-y-2">
                <div className="h-4 bg-gray-200 rounded" />
                <div className="h-4 w-2/3 bg-gray-100 rounded" />
                <div className="h-9 bg-gray-100 rounded-xl mt-2" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-none pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0 sm:overflow-visible sm:grid sm:grid-cols-3 lg:grid-cols-5 sm:gap-4">
          {products.map((p) => (
            <div key={p.id} className="basis-[46%] min-w-0 shrink-0 snap-start sm:basis-auto">
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-center gap-4 mb-6">
        <a href="/pre-orders" className="text-md font-medium text-primary hover:underline mt-6">
          View All Pre-Orders →
        </a>
      </div>
    </section>
  )
}
