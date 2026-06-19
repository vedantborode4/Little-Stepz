"use client"

import { useEffect, useState } from "react"
import { ProductService } from "../../lib/services/product.service"
import ProductCard from "../products/ProductCard"
import type { Product } from "../../types/product"

interface Props {
  sort?: string
  limit?: number
  showViewAll?: boolean
}

export default function BestSellers({ sort = "newest", limit = 5, showViewAll = true }: Props) {
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-2xl overflow-hidden animate-pulse">
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
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
