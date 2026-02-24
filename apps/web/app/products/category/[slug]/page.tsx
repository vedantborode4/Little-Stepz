"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"

import { ProductService } from "../../../../lib/services/product.service"
import type { Product } from "../../../../types/product"

import ProductCard from "../../../../components/products/ProductCard"
import ProductGridSkeleton from "../../../../components/products/ProductGridSkeleton"
import { Pagination } from "../../../../components/products/Pagination"

export default function CategoryProductsPage() {
  const { slug } = useParams<{ slug: string }>()

  const [products, setProducts] = useState<Product[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  /* ---------------- FORMAT TITLE ---------------- */

  const formattedTitle = useMemo(() => {
    if (!slug) return ""
    return slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  }, [slug])

  /* ---------------- FETCH ---------------- */

  useEffect(() => {
    if (!slug) return

    const fetchCategoryProducts = async () => {
      try {
        setLoading(true)
        setError(false)

        const res = await ProductService.getByCategorySlug(
          slug,
          page,
          12
        )

        setProducts(res.data)
        setTotalPages(res.meta.totalPages)
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    fetchCategoryProducts()
  }, [slug, page])

  /* ---------------- UI STATES ---------------- */

  if (loading) return <ProductGridSkeleton />

  if (error)
    return (
      <p className="text-center text-red-500 py-10">
        Failed to load category products
      </p>
    )

  if (!products.length)
    return (
      <p className="text-center py-10 text-muted">
        No products found in this category
      </p>
    )

  /* ---------------- PAGE ---------------- */

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

      {/* ✅ BREADCRUMB */}
      <div className="text-sm text-muted flex items-center gap-2 flex-wrap">
        <Link href="/" className="hover:text-primary">
          Home
        </Link>

        <span>/</span>

        <Link href="/products" className="hover:text-primary">
          Products
        </Link>

        <span>/</span>

        <span className="text-primary font-medium">
          {formattedTitle}
        </span>
      </div>

      {/* ✅ TITLE */}
      <h1 className="text-3xl font-bold text-primary text-center">
        {formattedTitle}
      </h1>

      {/* ✅ GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {/* ✅ PAGINATION */}
      <Pagination
        totalPages={totalPages}
        currentPage={page}
        onPageChange={setPage}
      />
    </div>
  )
}