"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { ProductService } from "../../lib/services/product.service"
import { buildProductQuery } from "../../lib/utils/buildProductQuery"

import { useProductFilterStore } from "../../store/useProductFilterStore"

import ProductCard from "../../components/products/ProductCard"
import ProductGridSkeleton from "../../components/products/ProductGridSkeleton"
import { Pagination } from "../../components/products/Pagination"
import FilterSidebar from "../../components/products/filters/FilterSidebar"
import MobileFilterDrawer from "../../components/products/filters/MobileFilterDrawer"

import type { Product } from "../../types/product"

export default function ProductsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const hasHydrated = useRef(false)

  const page = useProductFilterStore((s) => s.page)
  const category = useProductFilterStore((s) => s.category)
  const sort = useProductFilterStore((s) => s.sort)
  const priceMax = useProductFilterStore((s) => s.priceMax)
  const search = useProductFilterStore((s) => s.search)
  const setFilters = useProductFilterStore((s) => s.setFilters)

  const isSearchMode = !!search

  const [products, setProducts] = useState<Product[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (hasHydrated.current) return

    setFilters({
      page: Number(searchParams.get("page") || 1),
      category: searchParams.get("category") || undefined,
      sort: searchParams.get("sort") || undefined,
      search: searchParams.get("search") || undefined,
      priceMax: searchParams.get("priceMax")
        ? Number(searchParams.get("priceMax"))
        : undefined,
    })

    hasHydrated.current = true
  }, [searchParams, setFilters])

  useEffect(() => {
    if (!hasHydrated.current) return

    const fetchProducts = async () => {
      try {
        setLoading(true)
        setError(false)

        const res = await ProductService.getProducts({
          page,
          limit: 12,
          category,
          sort,
          priceMax,
          search,
        })

        setProducts(res.data)
        setTotalPages(res.meta.totalPages)
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [page, category, sort, priceMax, search])

  useEffect(() => {
    if (!hasHydrated.current) return

    const query = buildProductQuery({
      page,
      category,
      sort,
      priceMax,
      search,
    })

    if (query !== searchParams.toString()) {
      router.replace(`/products?${query}`, { scroll: false })
    }
  }, [page, category, sort, priceMax, search, router, searchParams])


  if (loading) return <ProductGridSkeleton />

  if (error)
    return (
      <p className="text-center text-red-500 py-10">
        Failed to load products
      </p>
    )

  if (!products.length)
    return (
      <div className="text-center py-16 space-y-3">
        <p className="text-lg font-medium">
          No results found for "{search}"
        </p>

        <button
          onClick={() => setFilters({ search: "", page: 1 })}
          className="text-primary font-medium"
        >
          Clear search
        </button>
      </div>
    )


  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      <h1 className="text-3xl font-bold text-primary text-center mb-8">
        {isSearchMode
          ? `Search results for "${search}"`
          : "Toys & Games"}
      </h1>

    <div
      className={`grid gap-8 ${
        isSearchMode
          ? "grid-cols-1"
          : "grid-cols-1 lg:grid-cols-[260px_1fr]"
      }`}
    >
      {!isSearchMode && <FilterSidebar />}

      <div className="w-full">
        {!isSearchMode && (
          <div className="flex justify-between items-center mb-4 lg:hidden">
            <MobileFilterDrawer />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {!isSearchMode && <Pagination totalPages={totalPages} />}
      </div>
    </div>
    </div>
  )
}