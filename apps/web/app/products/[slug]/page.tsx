"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { ProductService } from "../../../lib/services/product.service"
import type { Product } from "../../../types/product"

import ProductGallery from "../../../components/products/details/ProductGallery"
import ProductInfo from "../../../components/products/details/ProductInfo"
import SimilarProducts from "../../../components/products/details/SimilarProducts"

export default function ProductDetailsPage() {
  const { slug } = useParams()

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!slug) return

    const fetchProduct = async () => {
      try {
        setLoading(true)

        const data = await ProductService.getBySlug(slug as string)

        setProduct(data)
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    fetchProduct()
  }, [slug])

  if (loading)
    return <div className="py-20 text-center">Loading product...</div>

  if (error || !product)
    return <div className="py-20 text-center">Product not found</div>

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 space-y-16">

      <div className="grid lg:grid-cols-2 gap-10">

        <ProductGallery images={product.images} />

        <ProductInfo product={product} />

      </div>

      <SimilarProducts categoryId={product.category.id} />

    </div>
  )
}
