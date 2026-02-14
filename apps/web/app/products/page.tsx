"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { ProductService } from "../../lib/services/product.service"
import { parseQuery, buildQuery } from "../../lib/utils/product-query"

import { useProductFilterStore } from "../../store/useProductFilterStore"

import ProductCard from "../../components/products/ProductCard"
import ProductGridSkeleton from "../../components/products/ProductGridSkeleton"
import { Pagination } from "../../components/products/Pagination"

import type { Product } from "../../types/product"

export default function ProductsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const filters = useProductFilterStore()
  const { setFilters } = filters

  const [products, setProducts] = useState<Product[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  /* -------------------------------- */
  /* URL → ZUSTAND SYNC (ON LOAD)     */
  /* -------------------------------- */
  useEffect(() => {
    const query = parseQuery(searchParams)
    setFilters(query)
  }, [])

  /* -------------------------------- */
  /* ZUSTAND → URL SYNC               */
  /* -------------------------------- */
  useEffect(() => {
    const query = buildQuery(filters)

    router.replace(`?${query}`, { scroll: false })
  }, [
    filters.page,
    filters.category,
    filters.sort,
    filters.search,
  ])

  /* -------------------------------- */
  /* FETCH PRODUCTS                   */
  /* -------------------------------- */
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true)

        const res = await ProductService.getProducts(filters)

        setProducts(res.data)
        setTotalPages(res.meta.totalPages)
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [filters.page, filters.category, filters.sort, filters.search])

  /* -------------------------------- */

  if (loading) return <ProductGridSkeleton />

  if (error)
    return (
      <p className="text-center text-red-500">
        Failed to load products
      </p>
    )

  if (!products.length)
    return <p className="text-center">No products found</p>

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      <h1 className="text-3xl font-bold text-primary text-center mb-8">
        Toys & Games
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8">

        {/* FILTER SIDEBAR (NEXT STEP) */}
        <div className="hidden lg:block bg-white rounded-xl p-4 shadow-card h-fit">
          Filters
        </div>

        <div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          <Pagination totalPages={totalPages} />

        </div>
      </div>
    </div>
  )
}
