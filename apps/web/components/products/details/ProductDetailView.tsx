"use client"

import { useEffect, useMemo, useState } from "react"

import type { Product, Variant } from "../../../types/product"
import { ProductService } from "../../../lib/services/product.service"

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
export default function ProductDetailView({ product: initialProduct }: { product: Product }) {
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null)

  // The server payload is cached, so its availability can be stale — and
  // availability decides the In Stock badge and whether Add to Cart / Buy Now are
  // enabled. Re-read it live on mount and overlay just those fields, leaving the
  // server-rendered copy (title, description, specs, images) as the SEO source of
  // truth. Failures are ignored: the cached values are what we already show.
  const [live, setLive] = useState<Pick<
    Product,
    "inStock" | "quantity" | "variants" | "preOrderCount"
  > | null>(null)

  useEffect(() => {
    let active = true
    ProductService.getBySlug(initialProduct.slug)
      .then((fresh: any) => {
        if (!active || !fresh) return
        setLive({
          inStock: fresh.inStock,
          quantity: fresh.quantity,
          variants: fresh.variants,
          preOrderCount: fresh.preOrderCount,
        })
      })
      .catch(() => {})
    return () => { active = false }
  }, [initialProduct.slug])

  const product = useMemo(
    () => (live ? { ...initialProduct, ...live } : initialProduct),
    [initialProduct, live],
  )

  // `selectedVariant` is captured from the payload that was current when the
  // shopper picked it. Once fresh data lands, re-resolve it by id so its `stock`
  // is the live one — otherwise a variant selected pre-refresh keeps quoting the
  // stale availability that gates Add to Cart.
  const resolvedVariant = useMemo(
    () =>
      selectedVariant
        ? product.variants?.find((v) => v.id === selectedVariant.id) ?? selectedVariant
        : null,
    [selectedVariant, product.variants],
  )

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
            key={resolvedVariant?.id ?? "product"}
            images={resolvedVariant?.images?.length ? resolvedVariant.images : product.images}
          />
        </div>
        <ProductInfo
          product={product}
          selectedVariant={resolvedVariant}
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
