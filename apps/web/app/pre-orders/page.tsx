"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Clock } from "lucide-react"
import { ProductService } from "../../lib/services/product.service"
import ProductCard from "../../components/products/ProductCard"
import ProductGridSkeleton from "../../components/products/ProductGridSkeleton"
import type { Product } from "../../types/product"

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
]

export default function PreOrderProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [sort, setSort] = useState("newest")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(false)
        const res = await ProductService.getProducts({ page, limit: 12, sort, preOrder: true })
        setProducts(res.data)
        setTotalPages(res.meta.totalPages)
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [page, sort])

  return (
    <div className="max-w-7xl bg-surface mx-auto px-3 sm:px-4 py-5 sm:py-8">
      {/* Breadcrumb */}
      <div className="text-xs sm:text-sm text-muted flex items-center gap-1.5 sm:gap-2 flex-wrap mb-3 sm:mb-4">
        <Link href="/" className="hover:text-primary">Home</Link>
        <span>/</span>
        <span className="text-primary font-medium">Pre-Order</span>
      </div>

      <div className="text-center mb-5 sm:mb-8">
        <div className="inline-flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wide bg-primary/10 px-3 py-1 rounded-full">
          <Clock size={14} /> Pre-Order
        </div>
        <h1 className="text-xl sm:text-3xl font-bold text-primary mt-2">Pre-Order Products</h1>
        <p className="text-sm text-muted mt-1">Reserve upcoming & out-of-stock items — pay a small booking now, balance when it ships.</p>
      </div>

      {/* Sort */}
      <div className="flex justify-end mb-4">
        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value); setPage(1) }}
          className="border border-border rounded-xl px-3 py-2 text-sm bg-surface"
        >
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {loading ? (
        <ProductGridSkeleton />
      ) : error ? (
        <p className="text-center text-red-500 dark:text-red-400 py-10">Failed to load pre-order products</p>
      ) : !products.length ? (
        <div className="text-center py-16 space-y-2 px-4">
          <Clock size={32} className="text-faint mx-auto" />
          <p className="text-base sm:text-lg font-medium text-muted">No pre-order products right now</p>
          <p className="text-sm text-faint">Check back soon for upcoming arrivals.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted hover:bg-surface-2 disabled:opacity-40">‹</button>
              <span className="text-sm text-muted px-2">Page {page} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted hover:bg-surface-2 disabled:opacity-40">›</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
