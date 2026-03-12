"use client"

import { useEffect, useState } from "react"
import { ProductService } from "../../../lib/services/product.service"
import ProductCard from "../ProductCard"
import type { Product } from "../../../types/product"
import { Sparkles } from "lucide-react"

export default function SimilarProducts({ categoryId }: { categoryId: string }) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await ProductService.getProducts({ category: categoryId, limit: 4 })
        setProducts(res.data)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [categoryId])

  if (!loading && !products.length) return null

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-xl">
          <Sparkles size={16} className="text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">You May Also Like</h2>
          <p className="text-xs text-gray-400 mt-0.5">From the same category</p>
        </div>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {[1,2,3,4].map((i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl overflow-hidden animate-pulse">
              <div className="aspect-square bg-gray-100" />
              <div className="p-4 space-y-2.5">
                <div className="h-3 bg-gray-100 rounded-full w-3/4" />
                <div className="h-3 bg-gray-100 rounded-full w-1/2" />
                <div className="h-9 bg-gray-100 rounded-xl" />
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
