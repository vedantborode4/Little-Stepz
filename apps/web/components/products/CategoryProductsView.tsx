"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"

import { useCategoryStore } from "../../store/useCategoryStore"
import { useProductFilterStore } from "../../store/useProductFilterStore"
import { ProductService } from "../../lib/services/product.service"
import type { Product } from "../../types/product"

import Breadcrumbs from "../common/Breadcrumbs"
import ProductCard from "./ProductCard"
import ProductGridSkeleton from "./ProductGridSkeleton"
import { Pagination } from "./Pagination"
import FilterSidebar from "./filters/FilterSidebar"
import MobileFilterDrawer from "./filters/MobileFilterDrawer"
import DynamicPromoBanner from "../home/DynamicPromoBanner"

/**
 * Interactive category listing island (plan W1).
 *
 * Page 1 is fetched on the server and passed in via `initialProducts`, so the
 * H1, intro passage and the first grid of product links render into the initial
 * HTML. Filters, sorting and pagination re-fetch on the client after hydration.
 */
export default function CategoryProductsView({
  slug,
  heading,
  intro,
  initialProducts,
  initialTotalPages,
}: {
  slug: string
  heading: string
  intro: string
  initialProducts: Product[]
  initialTotalPages: number
}) {
  const { tree } = useCategoryStore()

  const sort = useProductFilterStore((s) => s.sort)
  const priceMin = useProductFilterStore((s) => s.priceMin)
  const priceMax = useProductFilterStore((s) => s.priceMax)

  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [totalPages, setTotalPages] = useState(initialTotalPages)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

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
      page: 1,
    })
  }, [slug])

  useEffect(() => {
    setPage(1)
  }, [slug, sort, priceMin, priceMax])

  // The server already delivered page 1 with no filters, so skip the first
  // client fetch — only re-fetch once the user changes page/sort/price.
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (!slug) return

    let ignore = false
    const run = async () => {
      try {
        setLoading(true)
        setError(false)
        const res = await ProductService.getByCategorySlug(
          slug,
          page,
          12,
          sort,
          priceMin,
          priceMax,
        )
        if (ignore) return
        setProducts(res.data)
        setTotalPages(res.meta.totalPages)
      } catch {
        if (!ignore) setError(true)
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    run()
    return () => {
      ignore = true
    }
  }, [slug, page, sort, priceMin, priceMax])

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

        <div className="w-full">
          <div className="flex justify-between items-center mb-4 lg:hidden">
            <MobileFilterDrawer />
          </div>

          {loading ? (
            <ProductGridSkeleton />
          ) : error ? (
            <p className="text-center text-red-500 dark:text-red-400 py-10">
              Failed to load category products
            </p>
          ) : !products.length ? (
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
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              <Pagination
                totalPages={totalPages}
                currentPage={page}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
