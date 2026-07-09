"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ProductService } from "../../lib/services/product.service"
import ProductSlider from "./ProductSlider"
import type { Product } from "../../types/product"

interface Props {
  slug: string
  title: string
  subtitle?: string
  limit?: number
}

/** A homepage section that shows a category's products in a 2-up horizontal slider. Hides itself when empty. */
export default function CategorySection({ slug, title, subtitle, limit = 12 }: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ProductService.getByCategorySlug(slug, 1, limit)
      .then((res) => setProducts(res.data.slice(0, limit)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [slug, limit])

  // Nothing to show → hide the whole section.
  if (!loading && products.length === 0) return null

  return (
    <section>
      {/* Constrain width on tablet/desktop so the 2-up slider cards aren't oversized */}
      <div className="md:px-12 lg:px-28 xl:px-44">
        {/* Header — title left, View All right */}
        <div className="flex items-end justify-between gap-4 mb-5 sm:mb-6">
          <div>
            <h2 className="text-2xl font-bold text-primary">{title}</h2>
            {subtitle && <p className="text-sm text-faint mt-0.5">{subtitle}</p>}
          </div>
          <Link
            href={`/products/category/${slug}`}
            className="text-sm font-medium text-primary hover:underline whitespace-nowrap"
          >
            View All {title} →
          </Link>
        </div>

        {loading ? (
          <div className="flex gap-3 sm:gap-5">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="basis-[80%] sm:basis-[47.5%] shrink-0 bg-surface border border-border rounded-2xl overflow-hidden animate-pulse">
                <div className="aspect-square bg-surface-2" />
                <div className="p-3 sm:p-4 space-y-2">
                  <div className="h-4 bg-surface-3 rounded" />
                  <div className="h-4 w-2/3 bg-surface-2 rounded" />
                  <div className="h-9 bg-surface-2 rounded-xl mt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ProductSlider products={products} itemClassName="basis-[80%] sm:basis-[47.5%]" />
        )}
      </div>
    </section>
  )
}
