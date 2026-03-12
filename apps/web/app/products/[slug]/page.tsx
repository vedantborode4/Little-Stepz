"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"

import { ProductService } from "../../../lib/services/product.service"
import type { Product } from "../../../types/product"

import ProductGallery from "../../../components/products/details/ProductGallery"
import ProductInfo from "../../../components/products/details/ProductInfo"
import SimilarProducts from "../../../components/products/details/SimilarProducts"
import ProductReviewSection from "../../../components/review/ProductReviewSection"

import Breadcrumbs from "../../../components/common/Breadcrumbs"
import { useCategoryStore } from "../../../store/useCategoryStore"
import { AlertTriangle } from "lucide-react"

export default function ProductDetailsPage() {
  const params = useParams<{ slug: string }>()
  const slug = params?.slug

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const tree = useCategoryStore((s) => s.tree)
  const setCategoryPath = useCategoryStore((s) => s.setCategoryPath)

  useEffect(() => {
    if (!slug) return
    const fetchProduct = async () => {
      try {
        setLoading(true)
        setError(false)
        const data = await ProductService.getBySlug(slug)
        setProduct(data)
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    fetchProduct()
  }, [slug])

  useEffect(() => {
    if (!useCategoryStore.getState().tree.length) {
      useCategoryStore.getState().fetchTree()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (product && tree.length) {
      setCategoryPath(product.category.slug)
    }
  }, [product, tree, setCategoryPath])

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="h-6 w-48 bg-gray-200 rounded-lg animate-pulse mb-8" />
        <div className="grid lg:grid-cols-2 gap-10">
          <div className="space-y-3">
            <div className="h-[420px] bg-gray-100 rounded-2xl animate-pulse" />
            <div className="flex gap-2">
              {[1,2,3].map(i => <div key={i} className="w-20 h-20 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          </div>
          <div className="space-y-4">
            <div className="h-8 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-8 w-32 bg-gray-100 rounded-lg animate-pulse" />
            <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 flex flex-col items-center gap-3 text-center">
          <AlertTriangle size={32} className="text-red-400" />
          <h2 className="text-lg font-semibold text-red-700">Product Not Found</h2>
          <p className="text-sm text-red-500">This product may have been removed or the link is incorrect.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-10">
      <Breadcrumbs product={product} />

      <div className="grid lg:grid-cols-2 gap-10">
        <ProductGallery images={product.images} />
        <ProductInfo product={product} />
      </div>

      {/* Review section - full width below */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <ProductReviewSection productId={product.id} />
      </div>

      <SimilarProducts categoryId={product.category.id} />
    </div>
  )
}
