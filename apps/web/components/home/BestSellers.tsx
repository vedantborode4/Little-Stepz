"use client"

import { useEffect, useState } from "react"
import { AdminService } from "../../lib/services/admin.service"
import { ProductService } from "../../lib/services/product.service"
import ProductCard from "../products/ProductCard"
import { TrendingUp, Loader2 } from "lucide-react"
import type { Product } from "../../types/product"

export default function BestSellers() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        // Get top selling product IDs from admin stats, then fetch full product data
        const [stats, allProducts] = await Promise.all([
          AdminService.getStats(),
          ProductService.getProducts({ limit: 20, sort: "newest" }),
        ])

        const topIds = (stats.topProducts ?? [])
          .slice(0, 5)
          .map((p: any) => p.productId)

        // Match full product objects by id
        let matched = topIds
          .map((id: string) => allProducts.data.find((p) => p.id === id))
          .filter(Boolean) as Product[]

        // Fallback: if not enough matches, fill with newest products
        if (matched.length < 4) {
          const extras = allProducts.data
            .filter((p) => !matched.find((m) => m.id === p.id))
            .slice(0, 5 - matched.length)
          matched = [...matched, ...extras]
        }

        setProducts(matched.slice(0, 5))
      } catch {
        // Fallback: just show newest 5
        try {
          const res = await ProductService.getProducts({ limit: 5, sort: "newest" })
          setProducts(res.data.slice(0, 5))
        } catch { /* silent */ }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <section>
      <div className="flex items-center justify-center gap-4 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
            <TrendingUp size={15} className="text-primary" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">Best Sellers</h2>
            <p className="text-xs text-gray-400">Our most loved products</p>
          </div>
        </div>

        <a
          href="/products"
          className="text-sm font-medium text-primary hover:underline"
        >
          View All →
        </a>
      </div>

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
    </section>
  )
}
