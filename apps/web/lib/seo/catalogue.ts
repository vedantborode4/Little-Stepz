import "server-only"

/**
 * Server-side catalogue reads for sitemap, llms.txt and (later) server-rendered
 * product pages.
 *
 * Deliberately NOT lib/api-client.ts — that instance is browser-coupled
 * (localStorage tokens, window.location redirects) and cannot run on the server.
 * These are public, unauthenticated endpoints.
 */

const BASE =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "https://littlestepz.in/api/v1"

export interface SeoCategory {
  slug: string
  name: string
  description: string | null
  updatedAt?: string
}

export interface SeoProduct {
  slug: string
  name: string
  description: string | null
  price: string
  salePrice: string | null
  inStock: boolean
  category: { slug: string; name: string }
  images: { url: string; alt: string | null }[]
  updatedAt?: string
}

/** Revalidate hourly — the catalogue changes rarely and this feeds cached routes. */
const REVALIDATE = 3600

async function getJson<T>(path: string, tag: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      next: { revalidate: REVALIDATE, tags: [tag] },
    })
    if (!res.ok) return null
    return (await res.json()).data as T
  } catch {
    // A dead backend must not take the sitemap route down with it — callers
    // fall back to static entries.
    return null
  }
}

export async function getCategories(): Promise<SeoCategory[]> {
  return (await getJson<SeoCategory[]>("/categories", "categories")) ?? []
}

export async function getProductBySlug(slug: string): Promise<SeoProduct | null> {
  return await getJson<SeoProduct>(`/products/${encodeURIComponent(slug)}`, `product:${slug}`)
}

export async function getCategoryBySlug(slug: string): Promise<SeoCategory | null> {
  const all = await getCategories()
  return all.find((c) => c.slug === slug) ?? null
}

/** Products in a category — used for CollectionPage ItemList and the count in copy. */
export async function getProductsByCategory(slug: string): Promise<SeoProduct[]> {
  const data = await getJson<{ products: SeoProduct[] }>(
    `/products/category/${encodeURIComponent(slug)}?limit=100`,
    `category:${slug}`,
  )
  return data?.products ?? []
}

export async function getAllProducts(): Promise<SeoProduct[]> {
  const out: SeoProduct[] = []
  for (let page = 1; page <= 20; page++) {
    const data = await getJson<{ products: SeoProduct[]; meta?: { totalPages?: number } }>(
      `/products?page=${page}&limit=100`,
      "products",
    )
    if (!data?.products?.length) break
    out.push(...data.products)
    if (page >= (data.meta?.totalPages ?? 1)) break
  }
  return out
}
