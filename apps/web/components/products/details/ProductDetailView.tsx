"use client"

import { useEffect, useState } from "react"

import type { Product, Variant } from "../../../types/product"

import ProductGallery from "./ProductGallery"
import ProductInfo from "./ProductInfo"
import SimilarProducts from "./SimilarProducts"
import ProductReviewSection from "../../review/ProductReviewSection"
import Breadcrumbs from "../../common/Breadcrumbs"
import { useCategoryStore } from "../../../store/useCategoryStore"
import { trackViewItem } from "../../../lib/analytics/ecommerce"

/**
 * Interactive product-detail island.
 *
 * The `product` is fetched on the server (see the route's page.tsx) and passed
 * in as a prop, so this renders WITH data during SSR — the H1, description and
 * specs land in the initial HTML (plan W1). Only the interactive bits (variant
 * selection, gallery state, cart/wishlist) run on the client after hydration.
 */
export default function ProductDetailView({ product }: { product: Product }) {
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null)

  const tree = useCategoryStore((s) => s.tree)
  const setCategoryPath = useCategoryStore((s) => s.setCategoryPath)

  // GA4: product view (plan W7).
  useEffect(() => {
    trackViewItem(product)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id])

  useEffect(() => {
    if (!useCategoryStore.getState().tree.length) {
      useCategoryStore.getState().fetchTree()
    }
  }, [])

  useEffect(() => {
    if (tree.length) setCategoryPath(product.category.slug)
  }, [product, tree, setCategoryPath])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-10">
      <Breadcrumbs product={product} />

      <div className="grid lg:grid-cols-2 gap-10 lg:items-start">
        <div className="lg:sticky lg:top-20 self-start">
          <ProductGallery
            key={selectedVariant?.id ?? "product"}
            images={selectedVariant?.images?.length ? selectedVariant.images : product.images}
          />
        </div>
        <ProductInfo
          product={product}
          selectedVariant={selectedVariant}
          onSelectVariant={setSelectedVariant}
        />
      </div>

      {/* Review section - full width below */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
        <ProductReviewSection productId={product.id} />
      </div>

      <SimilarProducts categoryId={product.category.id} />
    </div>
  )
}
