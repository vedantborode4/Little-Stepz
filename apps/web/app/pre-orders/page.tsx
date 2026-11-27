"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { Clock } from "lucide-react"
import { ProductService } from "../../lib/services/product.service"
import ProductCard from "../../components/products/ProductCard"
import ProductGridSkeleton from "../../components/products/ProductGridSkeleton"
import InfiniteScrollSentinel from "../../components/products/InfiniteScrollSentinel"
import { useInfiniteProducts } from "../../hooks/useInfiniteProducts"
import { PRODUCTS_PER_LOAD } from "../../lib/utils/catalogue-paging"

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
]

export default function PreOrderProductsPage() {
  const [sort, setSort] = useState("newest")
  const resultsRef = useRef<HTMLDivElement>(null)
  const list = useInfiniteProducts({
    key: `pre-orders?sort=${sort}`,
    scrollTargetRef: resultsRef,
    fetchPage: (page) => ProductService.getProducts({ page, limit: PRODUCTS_PER_LOAD, sort, preOrder: true }),
  })

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
      <div ref={resultsRef} className="flex justify-end mb-4 scroll-mt-20">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="border border-border rounded-xl px-3 py-2 text-sm bg-surface"
        >
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {list.loading ? (
        <ProductGridSkeleton />
      ) : list.error && !list.products.length ? (
        <div className="text-center py-10 space-y-3">
          <p className="text-red-500 dark:text-red-400">Failed to load pre-order products</p>
          <button onClick={list.retry} className="text-primary font-medium">
            Try again
          </button>
        </div>
      ) : !list.products.length ? (
        <div className="text-center py-16 space-y-2 px-4">
          <Clock size={32} className="text-faint mx-auto" />
          <p className="text-base sm:text-lg font-medium text-muted">No pre-order products right now</p>
          <p className="text-sm text-faint">Check back soon for upcoming arrivals.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
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
            noun="pre-order products"
            gridClassName="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6"
            placeholders={4}
          />
        </>
      )}
    </div>
  )
}
