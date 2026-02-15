"use client"

import { useEffect, useState } from "react"
import { ProductService } from "../../../lib/services/product.service"
import ProductCard from "../ProductCard"
import type { Product } from "../../../types/product"

export default function SimilarProducts({
  categoryId,
}: {
  categoryId: string
}) {
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    const fetch = async () => {
      const res = await ProductService.getProducts({
        category: categoryId,
        limit: 4,
      })

      setProducts(res.data)
    }

    fetch()
  }, [categoryId])

  return (
    <div className="space-y-6">

      <h2 className="text-2xl font-bold text-primary text-center">
        Similar Products
      </h2>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>

    </div>
  )
}
