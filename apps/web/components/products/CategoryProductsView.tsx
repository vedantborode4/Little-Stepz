"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"

import { useCategoryStore } from "../../store/useCategoryStore"
import { useProductFilterStore } from "../../store/useProductFilterStore"
import { ProductService } from "../../lib/services/product.service"
import { buildProductQuery } from "../../lib/utils/buildProductQuery"
import { PRODUCTS_PER_LOAD } from "../../lib/utils/catalogue-paging"
import { useInfiniteProducts } from "../../hooks/useInfiniteProducts"
import type { Product } from "../../types/product"

import Breadcrumbs from "../common/Breadcrumbs"
import ProductCard from "./ProductCard"
import ProductGridSkeleton from "./ProductGridSkeleton"
import InfiniteScrollSentinel from "./InfiniteScrollSentinel"
import FilterSidebar from "./filters/FilterSidebar"
import MobileFilterDrawer from "./filters/MobileFilterDrawer"
import DynamicPromoBanner from "../home/DynamicPromoBanner"

/**
 * Interactive category listing island (plan W1).
 *
 * The first batch is fetched on the server and passed in via `initialProducts`, so
 * the H1, intro passage and the first grid of product links render into the initial
 * HTML. Filters and sorting re-fetch on the client; more products load on scroll.
 */
export default function CategoryProductsView({
  slug,
  heading,
  intro,
  initialProducts,
  initialTotalPages,
  initialTotal,
}: {
  slug: string
  heading: string
  intro: string
  initialProducts: Product[]
  initialTotalPages: number
  initialTotal: number
}) {
  const { tree } = useCategoryStore()

  const sort = useProductFilterStore((s) => s.sort)
  const priceMin = useProductFilterStore((s) => s.priceMin)
  const priceMax = useProductFilterStore((s) => s.priceMax)

  // The list waits until leftover filters from another page are cleared for this category.
  const [readySlug, setReadySlug] = useState<string | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const list = useInfiniteProducts({
    key: `category/${slug}?${buildProductQuery({ sort, priceMin, priceMax })}`,
    enabled: readySlug === slug,
    scrollTargetRef: resultsRef,
    initial: {
      key: `category/${slug}?`,
      products: initialProducts,
      totalPages: initialTotalPages,
      total: initialTotal,
    },
    fetchPage: (page) =>
      ProductService.getByCategorySlug(slug, page, PRODUCTS_PER_LOAD, sort, priceMin, priceMax),
  })

  useEffect(() => {
    if (!useCategoryStore.getState().tree.length) {
      useCategoryStore.getState().fetchTree()
    }
  }, [])

  useEffect(() => {
    if (slug && tree.length) {
      useCategoryStore.getState().setCategoryPath(slug)
    }
  }, [slug, tree])

  // Entering a category: clear leftover global sort/price so it isn't over-filtered.
  useEffect(() => {
    useProductFilterStore.getState().setFilters({
      sort: undefined,
      priceMin: undefined,
      priceMax: undefined,
    })
    setReadySlug(slug)
  }, [slug])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <DynamicPromoBanner position="CATEGORY_TOP" />

      <Breadcrumbs />

      <header className="text-center space-y-3">
        <h1 className="text-3xl font-bold text-primary">{heading}</h1>
        {intro && (
          <p className="max-w-3xl mx-auto text-sm text-muted leading-relaxed">{intro}</p>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8">
        <div className="space-y-4">
          <FilterSidebar />
          <DynamicPromoBanner position="PRODUCT_SIDEBAR" />
        </div>

        <div ref={resultsRef} className="w-full scroll-mt-20">
          <div className="flex justify-between items-center mb-4 lg:hidden">
            <MobileFilterDrawer />
          </div>

          {list.loading ? (
            <ProductGridSkeleton />
          ) : list.error && !list.products.length ? (
            <div className="text-center py-10 space-y-3">
              <p className="text-red-500 dark:text-red-400">Failed to load category products</p>
              <button onClick={list.retry} className="text-primary font-medium">
                Try again
              </button>
            </div>
          ) : !list.products.length ? (
            <div className="max-w-2xl mx-auto text-center py-16 space-y-6">
              <p className="text-lg font-medium">No products found in this category</p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link
                  href="/products"
                  className="px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 transition"
                >
                  View all products
                </Link>
                <Link
                  href="/"
                  className="px-5 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-surface-2 transition"
                >
                  Browse other categories
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-6">
                {list.products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              <InfiniteScrollSentinel
                hasMore={list.hasMore}
                loadingMore={list.loadingMore}
                error={list.error}
                onLoadMore={list.loadMore}
                onRetry={list.retry}
                shown={list.products.length}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
