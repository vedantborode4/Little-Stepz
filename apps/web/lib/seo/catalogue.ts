import "server-only"
import { notFound } from "next/navigation"
import type { Product } from "../../types/product"

/**
 * Server-side catalogue reads for sitemap, llms.txt and server-rendered
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
  metaTitle?: string | null
  metaDescription?: string | null
  ogImage?: string | null
  noindex?: boolean
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
  metaTitle?: string | null
  metaDescription?: string | null
  ogImage?: string | null
  noindex?: boolean
  preOrderEnabled?: boolean
  brand?: string | null
  gtin?: string | null
  mpn?: string | null
  condition?: string | null
  updatedAt?: string
}

/** Revalidate hourly — the catalogue changes rarely and this feeds cached routes. */
const REVALIDATE = 3600

/**
 * Product detail is cached far more briefly than the rest of the catalogue.
 *
 * Its payload carries `inStock`, `quantity` and per-variant `stock`, which drive
 * the In Stock badge and whether Add to Cart / Buy Now are enabled. At the hourly
 * catalogue TTL a sold-out product went on advertising itself as available for up
 * to an hour. `revalidateTag` is never called anywhere in this app, so the TTL is
 * the only thing bounding that staleness. ProductDetailView additionally refreshes
 * availability on mount, so this only bounds what the FIRST paint (and a crawler)
 * can be wrong by.
 */
const PRODUCT_REVALIDATE = 60

async function getJson<T>(path: string, tag: string, revalidate = REVALIDATE): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      next: { revalidate, tags: [tag] },
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
  // Same URL *and* same revalidate as getFullProductBySlug, so Next still dedupes
  // the metadata fetch with the page fetch into one network call. Differing cache
  // options would split them into two entries. Its JSON-LD carries availability
  // too, so the shorter TTL is correct here as well.
  return await getJson<SeoProduct>(
    `/products/${encodeURIComponent(slug)}`,
    `product:${slug}`,
    PRODUCT_REVALIDATE,
  )
}

/**
 * Full product for the server-rendered product page (W1). Hits the same
 * `/products/:slug` endpoint as the browser service, so Next dedupes it with the
 * layout's metadata fetch — one network call feeds both metadata and the page.
 */
export async function getFullProductBySlug(slug: string): Promise<Product | null> {
  return await getJson<Product>(
    `/products/${encodeURIComponent(slug)}`,
    `product:${slug}`,
    PRODUCT_REVALIDATE,
  )
}

/**
 * Called when a product lookup came back empty (audit LS-21).
 *
 * Unknown slugs used to render the not-found UI with HTTP 200 (a soft 404). Only
 * a real "404 Not Found" from the API becomes notFound(); if the API could not
 * be reached we throw instead, so a backend outage answers 500 — which Google
 * treats as temporary — rather than turning every product URL into a 404.
 */
export async function missingProduct(slug: string): Promise<never> {
  let status = 0
  try {
    const res = await fetch(`${BASE}/products/${encodeURIComponent(slug)}`, { cache: "no-store" })
    status = res.status
  } catch {
    // network failure: fall through to the error below
  }
  if (status === 404) notFound()
  throw new Error(`Product lookup failed for "${slug}" (API status ${status || "unreachable"})`)
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

/**
 * Page 1 of a category's full products, for the server-rendered category grid
 * (W1). Separate from getProductsByCategory (which returns the SeoProduct subset
 * for schema/counts) because ProductCard needs the full Product shape.
 */
export async function getCategoryProductsPage(
  slug: string,
  limit = 12,
): Promise<{ products: Product[]; totalPages: number }> {
  const data = await getJson<{ products: Product[]; pages?: number }>(
    `/products/category/${encodeURIComponent(slug)}?page=1&limit=${limit}`,
    `category:${slug}`,
  )
  return { products: data?.products ?? [], totalPages: data?.pages ?? 1 }
}

/**
 * Page 1 of the full catalogue, for the server-rendered /products listing (W1).
 * Renders the default (unfiltered) grid into HTML; the client island applies any
 * URL filters/search/pagination after hydration.
 */
export async function getProductsPage(
  limit = 12,
): Promise<{ products: Product[]; totalPages: number }> {
  const data = await getJson<{ products: Product[]; pages?: number }>(
    `/products?page=1&limit=${limit}`,
    "products",
  )
  return { products: data?.products ?? [], totalPages: data?.pages ?? 1 }
}

/**
 * Featured products for the server-rendered homepage sections (W1) — Best
 * Sellers, New Arrivals, etc. Mirrors the sort keys the client ProductService
 * uses so the seeded grid matches what the client would fetch.
 */
const HOME_SORT_MAP: Record<string, string> = {
  price_asc: "price:asc",
  price_desc: "price:desc",
  newest: "createdAt:desc",
  oldest: "createdAt:asc",
  name_asc: "name:asc",
  name_desc: "name:desc",
}

export async function getFeaturedProducts(
  sortKey: string,
  limit = 8,
): Promise<Product[]> {
  const sort = HOME_SORT_MAP[sortKey] ?? sortKey
  const data = await getJson<{ products: Product[] }>(
    `/products?page=1&limit=${limit}&sort=${encodeURIComponent(sort)}`,
    `products:${sortKey}`,
  )
  return (data?.products ?? []).slice(0, limit)
}

/** The products API's largest page; it clamps anything bigger to this. */
const PAGE_SIZE = 100

/**
 * Every product, for the sitemap, the Merchant Center feed and llms.txt.
 *
 * The list endpoint answers `{ products, total, page, limit, pages }`. This loop
 * used to stop on `meta.totalPages`, which the API never sends, so it always
 * ended after page 1: once the catalogue passed 100 products, the rest were
 * missing from all three (audit LS-01). If `pages` is ever absent, a short page
 * still marks the last one, rather than quietly stopping at 100 again.
 */
export async function getAllProducts(): Promise<SeoProduct[]> {
  const out: SeoProduct[] = []
  for (let page = 1; page <= 20; page++) {
    const data = await getJson<{ products: SeoProduct[]; pages?: number }>(
      `/products?page=${page}&limit=${PAGE_SIZE}`,
      "products",
    )
    if (!data?.products?.length) break
    out.push(...data.products)
    const isLast =
      data.pages !== undefined ? page >= data.pages : data.products.length < PAGE_SIZE
    if (isLast) break
  }
  return out
}
