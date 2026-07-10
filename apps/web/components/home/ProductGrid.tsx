import ProductCard from "../products/ProductCard"
import type { Product } from "../../types/product"

/** Responsive product grid — 2 columns on mobile, 3 on tablet, 4 on desktop. */
export default function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  )
}

/** Matching skeleton grid to avoid layout jump while products load. */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-surface border border-border rounded-2xl overflow-hidden animate-pulse">
          <div className="aspect-square bg-surface-2" />
          <div className="p-3 sm:p-4 space-y-2">
            <div className="h-4 bg-surface-3 rounded" />
            <div className="h-4 w-2/3 bg-surface-2 rounded" />
            <div className="h-9 bg-surface-2 rounded-xl mt-2" />
          </div>
        </div>
      ))}
    </div>
  )
}
