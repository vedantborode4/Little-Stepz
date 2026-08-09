"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"

import { ProductService } from "../../lib/services/product.service"
import { buildProductQuery } from "../../lib/utils/buildProductQuery"
import { useProductFilterStore } from "../../store/useProductFilterStore"
import { useCategoryStore } from "../../store/useCategoryStore"

import ProductCard from "./ProductCard"
import ProductGridSkeleton from "./ProductGridSkeleton"
import { Pagination } from "./Pagination"
import FilterSidebar from "./filters/FilterSidebar"
import MobileFilterDrawer from "./filters/MobileFilterDrawer"
import DynamicPromoBanner from "../home/DynamicPromoBanner"

import type { Product } from "../../types/product"

/**
 * Interactive catalogue listing island (plan W1).
 *
 * Page 1 of the unfiltered catalogue is fetched on the server and passed in via
 * `initialProducts`, so the H1 and the first grid render into the initial HTML.
 * The store starts at its defaults (no filters) — matching the server render, so
 * hydration is clean — then reads the URL and applies filters/search/pagination.
 */
export default function ProductsListingView({
  initialProducts,
  initialTotalPages,
}: {
  initialProducts: Product[]
  initialTotalPages: number
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const hasHydrated = useRef(false)

  const page     = useProductFilterStore((s) => s.page)
  const category = useProductFilterStore((s) => s.category)
  const sort     = useProductFilterStore((s) => s.sort)
  const priceMin = useProductFilterStore((s) => s.priceMin)
  const priceMax = useProductFilterStore((s) => s.priceMax)
  const search   = useProductFilterStore((s) => s.search)
  const setFilters = useProductFilterStore((s) => s.setFilters)

  const tree = useCategoryStore((s) => s.tree)

  const isSearchMode = !!search

  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [totalPages, setTotalPages] = useState(initialTotalPages)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!useCategoryStore.getState().tree.length) {
      useCategoryStore.getState().fetchTree()
    }
  }, [])

  const getCategoryName = (slug?: string): string | null => {
    if (!slug || !tree.length) return null
    const find = (nodes: any[]): string | null => {
      for (const node of nodes) {
        if (node.slug === slug) return node.name
        if (node.children?.length) {
          const found = find(node.children)
          if (found) return found
        }
      }
      return null
    }
    return find(tree)
  }

  useEffect(() => {
    if (hasHydrated.current) return
    useProductFilterStore.getState().setFilters({
      page:     Number(searchParams.get("page") || 1),
      category: searchParams.get("category") || undefined,
      sort:     searchParams.get("sort") || undefined,
      search:   searchParams.get("search") || undefined,
      priceMin: searchParams.get("priceMin") ? Number(searchParams.get("priceMin")) : undefined,
      priceMax: searchParams.get("priceMax") ? Number(searchParams.get("priceMax")) : undefined,
    })
    hasHydrated.current = true
  }, [searchParams])

  // Keep `search` in sync with the URL after hydration.
  useEffect(() => {
    if (!hasHydrated.current) return
    const urlSearch = searchParams.get("search") || undefined
    const storeSearch = useProductFilterStore.getState().search || undefined
    if (urlSearch !== storeSearch) {
      setFilters({ search: urlSearch, page: Number(searchParams.get("page") || 1) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // First render already has server data for the default view — only fetch once
  // the store has hydrated from the URL (and on every filter change thereafter).
  const skipFirstFetch = useRef(true)
  useEffect(() => {
    if (!hasHydrated.current) return
    if (
      skipFirstFetch.current &&
      page === 1 && !category && !sort && priceMin === undefined && priceMax === undefined && !search
    ) {
      // Default view — server already delivered it; don't refetch.
      skipFirstFetch.current = false
      return
    }
    skipFirstFetch.current = false
    const fetchProducts = async () => {
      try {
        setLoading(true)
        setError(false)
        const res = await ProductService.getProducts({ page, limit: 12, category, sort, priceMin, priceMax, search })
        setProducts(res.data)
        setTotalPages(res.meta.totalPages)
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [page, category, sort, priceMin, priceMax, search])

  useEffect(() => {
    if (!hasHydrated.current) return
    const query = buildProductQuery({ page, category, sort, priceMin, priceMax, search })
    if (query !== searchParams.toString()) {
      router.replace(`/products?${query}`, { scroll: false })
    }
  }, [page, category, sort, priceMin, priceMax, search, router, searchParams])

  if (loading) return <ProductGridSkeleton />
  if (error) return <p className="text-center text-red-500 dark:text-red-400 py-10">Failed to load products</p>

  const categoryName = getCategoryName(category)
  const hasNoResults = !products.length

  return (
    <div className="max-w-7xl bg-surface mx-auto px-3 sm:px-4 py-5 sm:py-8">

      {/* BREADCRUMB */}
      <div className="text-xs sm:text-sm text-muted flex items-center gap-1.5 sm:gap-2 flex-wrap mb-3 sm:mb-4">
        <Link href="/" className="hover:text-primary">Home</Link>
        <span>/</span>
        <Link href="/products" className="hover:text-primary">Products</Link>
        {categoryName && (
          <>
            <span>/</span>
            <span className="text-primary font-medium">{categoryName}</span>
          </>
        )}
        {isSearchMode && (
          <>
            <span>/</span>
            <span className="text-primary font-medium">Search</span>
          </>
        )}
      </div>

      <h1 className="text-xl sm:text-3xl font-bold text-primary text-center mb-5 sm:mb-8">
        {isSearchMode ? `Search results for "${search}"` : categoryName || "All Products"}
      </h1>

      <div className={`grid gap-4 sm:gap-8 ${isSearchMode ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-[260px_1fr]"}`}>
        {/* Sidebar (filters + promo) stays mounted even when there are no results,
            so a too-narrow price filter can always be adjusted/cleared. */}
        {!isSearchMode && (
          <div className="space-y-4">
            <FilterSidebar />
            <DynamicPromoBanner position="PRODUCT_SIDEBAR" />
          </div>
        )}

        <div className="w-full">
          {!isSearchMode && (
            <div className="flex justify-between items-center mb-3 sm:mb-4 lg:hidden">
              <MobileFilterDrawer />
            </div>
          )}

          {hasNoResults ? (
            <div className="text-center py-16 space-y-3 px-4">
              <p className="text-base sm:text-lg font-medium text-muted">
                {isSearchMode ? `No results found for "${search}"` : "No products match these filters"}
              </p>
              <p className="text-sm text-faint">Try widening your price range or clearing the filters.</p>
              <button
                onClick={() => setFilters({ search: "", priceMin: undefined, priceMax: undefined, page: 1 })}
                className="text-primary font-medium"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-6">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {!isSearchMode && <Pagination totalPages={totalPages} />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
