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

export default function ProductDetailsPage() {
  const params = useParams<{ slug: string }>()
  const slug = params?.slug

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const tree = useCategoryStore((s) => s.tree)
  const setCategoryPath = useCategoryStore((s) => s.setCategoryPath)

  /* ---------------- FETCH PRODUCT ---------------- */

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

  /* ---------------- ENSURE CATEGORY TREE ---------------- */

  useEffect(() => {
    if (!useCategoryStore.getState().tree.length) {
      useCategoryStore.getState().fetchTree()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---------------- SET CATEGORY PATH ---------------- */

  useEffect(() => {
    if (product && tree.length) {
      setCategoryPath(product.category.slug)
    }
  }, [product, tree, setCategoryPath])

  /* ---------------- STATES ---------------- */

  if (loading) {
    return (
      <div className="py-20 text-center">
        Loading product...
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="py-20 text-center">
        Product not found
      </div>
    )
  }

  /* ---------------- PAGE ---------------- */

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 space-y-16">

      {/* ✅ BREADCRUMBS (NEW – SAFE ADDITION) */}
      <Breadcrumbs product={product} />

      <div className="grid lg:grid-cols-2 gap-10">

        <ProductGallery images={product.images} />

        <ProductInfo product={product} />

        <ProductReviewSection productId={product.id} />

      </div>

      <SimilarProducts categoryId={product.category.id} />

    </div>
  )
}