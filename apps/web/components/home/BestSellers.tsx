"use client"

import { useEffect, useState } from "react"
import { ProductService } from "../../lib/services/product.service"
import ProductCard from "../products/ProductCard"
import { TrendingUp } from "lucide-react"
import type { Product } from "../../types/product"

export default function BestSellers() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        // Fetch newest products publicly — no admin endpoint needed
        const res = await ProductService.getProducts({ limit: 5, sort: "newest" })
        setProducts(res.data.slice(0, 5))
      } catch {
        // silent — home page should never break due to this section
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <section>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-2xl overflow-hidden animate-pulse">
              <div className="aspect-square bg-gray-100" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-gray-200 rounded" />
                <div className="h-4 w-2/3 bg-gray-100 rounded" />
                <div className="h-9 bg-gray-100 rounded-xl mt-2" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

            <div className="flex items-center justify-center gap-4 mb-6">
        <a
          href="/products"
          className="text-md font-medium text-primary hover:underline mt-6"
        >
          View All →
        </a>
      </div>
    </section>
  )
}