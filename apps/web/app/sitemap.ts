import type { MetadataRoute } from "next"
import { getAllProducts, getCategories } from "../lib/seo/catalogue"
import { EMPTY_CATEGORIES, absolute } from "../lib/seo/site"

/**
 * Serves /sitemap.xml (proposal §4.1 — currently HTTP 404 in production).
 *
 * Only indexable URLs belong here: no auth-gated, transactional or thin pages.
 * Empty categories are excluded — a category page with zero products is thin
 * content and submitting it invites a Search Console "crawled, not indexed".
 */

export const revalidate = 3600

const STATIC: { path: string; priority: number; freq: MetadataRoute.Sitemap[0]["changeFrequency"] }[] = [
  { path: "/", priority: 1.0, freq: "daily" },
  { path: "/products", priority: 0.9, freq: "daily" },
  { path: "/pre-orders", priority: 0.7, freq: "weekly" },
  { path: "/about", priority: 0.6, freq: "monthly" },
  { path: "/faq", priority: 0.6, freq: "monthly" },
  { path: "/support", priority: 0.5, freq: "yearly" },
  { path: "/shipping", priority: 0.4, freq: "yearly" },
  { path: "/returns", priority: 0.4, freq: "yearly" },
  { path: "/cancellation", priority: 0.3, freq: "yearly" },
  { path: "/warranty", priority: 0.4, freq: "yearly" },
  { path: "/unboxing-policy", priority: 0.4, freq: "yearly" },
  { path: "/privacy", priority: 0.3, freq: "yearly" },
  { path: "/terms", priority: 0.3, freq: "yearly" },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const entries: MetadataRoute.Sitemap = STATIC.map((s) => ({
    url: absolute(s.path),
    lastModified: now,
    changeFrequency: s.freq,
    priority: s.priority,
  }))

  const [categories, products] = await Promise.all([getCategories(), getAllProducts()])

  // Only list categories that actually hold stock.
  const populated = new Set(products.map((p) => p.category?.slug).filter(Boolean))

  for (const c of categories) {
    if (EMPTY_CATEGORIES.includes(c.slug) || !populated.has(c.slug) || c.noindex) continue
    entries.push({
      url: absolute(`/products/category/${c.slug}`),
      lastModified: c.updatedAt ? new Date(c.updatedAt) : now,
      changeFrequency: "weekly",
      priority: 0.8,
    })
  }

  for (const p of products) {
    if (p.noindex) continue // admin excluded this product from search + sitemap
    entries.push({
      url: absolute(`/products/${p.slug}`),
      lastModified: p.updatedAt ? new Date(p.updatedAt) : now,
      changeFrequency: "weekly",
      priority: 0.7,
    })
  }

  return entries
}
