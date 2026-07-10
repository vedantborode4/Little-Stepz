"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ProductService } from "../../lib/services/product.service"
import ProductSlider from "./ProductSlider"
import SectionHeader from "./SectionHeader"
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
      .catch((err) => {
        // Never swallow this: a mis-typed slug otherwise kills the whole
        // merchandising section silently on every page load.
        const status = err?.response?.status
        const reason = err?.response?.data?.message ?? err?.message ?? "unknown error"
        console.error(
          status === 404
            ? `[CategorySection] Category slug "${slug}" does not exist (404). The section will not render.`
            : `[CategorySection] Failed to load category "${slug}"${status ? ` (HTTP ${status})` : ""}: ${reason}`
        )
      })
      .finally(() => setLoading(false))
  }, [slug, limit])

  // Nothing to show → hide the whole section.
  if (!loading && products.length === 0) return null

  return (
    <section>
      {/* Shared centered heading (Anton) — consistent with every other homepage section. */}
      <SectionHeader title={title} subtitle={subtitle} />

      {/* Constrain width on tablet/desktop so the 2-up slider cards aren't oversized */}
      <div className="md:px-12 lg:px-28 xl:px-44">
        {loading ? (
          <div className="flex gap-3 sm:gap-5">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="basis-full sm:basis-[calc(50%-10px)] shrink-0 bg-surface border border-border rounded-2xl overflow-hidden animate-pulse">
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
          <ProductSlider products={products} itemClassName="basis-full sm:basis-[calc(50%-10px)]" />
        )}
      </div>

      {/* View All — below the cards, centered */}
      <div className="flex justify-center mt-6">
        <Link
          href={`/products/category/${slug}`}
          className="text-md font-medium text-primary hover:underline"
        >
          View All {title} →
        </Link>
      </div>
    </section>
  )
}
