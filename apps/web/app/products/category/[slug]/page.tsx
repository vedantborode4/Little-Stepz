"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { useCategoryStore } from "../../../../store/useCategoryStore"

import Breadcrumbs from "../../../../components/common/Breadcrumbs"

import { ProductService } from "../../../../lib/services/product.service"
import type { Product } from "../../../../types/product"

import ProductCard from "../../../../components/products/ProductCard"
import ProductGridSkeleton from "../../../../components/products/ProductGridSkeleton"
import { Pagination } from "../../../../components/products/Pagination"
import FilterSidebar from "../../../../components/products/filters/FilterSidebar"
import MobileFilterDrawer from "../../../../components/products/filters/MobileFilterDrawer"
import Link from "next/link"

export default function CategoryProductsPage() {
  const { slug } = useParams<{ slug: string }>()

  const { tree, fetchTree, setCategoryPath } = useCategoryStore()

  const [products, setProducts] = useState<Product[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const formattedTitle = useMemo(() => {
    if (!slug) return ""
    return slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  }, [slug])

  useEffect(() => {
    if (!tree.length) fetchTree()
  }, [tree.length, fetchTree])

  useEffect(() => {
    if (slug && tree.length) {
      setCategoryPath(slug)
    }
  }, [slug, tree, setCategoryPath])

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

  if (loading) return <ProductGridSkeleton />

  if (error)
    return (
      <p className="text-center text-red-500 py-10">
        Failed to load category products
      </p>
    )

  const fallbackCategory = tree?.[0]

  if (!products.length)
    return (
      <div className="max-w-2xl mx-auto text-center py-16 space-y-6">

        <p className="text-lg font-medium">
          No products found in this category
        </p>

        <div className="flex flex-wrap justify-center gap-3">

          <Link
            href="/products"
            className="px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 transition"
          >
            View all products
          </Link>

          {fallbackCategory && (
            <Link
              href={`/products/category/${fallbackCategory.slug}`}
              className="px-5 py-2.5 rounded-lg border text-sm font-medium hover:bg-gray-50 transition"
            >
              Browse other categories
            </Link>
          )}

        </div>
      </div>
    )

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

      <Breadcrumbs />

      <h1 className="text-3xl font-bold text-primary text-center">
        {formattedTitle}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8">

        <FilterSidebar />

        <div className="w-full">

          <div className="flex justify-between items-center mb-4 lg:hidden">
            <MobileFilterDrawer />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          <Pagination
            totalPages={totalPages}
            currentPage={page}
            onPageChange={setPage}
          />

        </div>
      </div>
    </div>
  )
}