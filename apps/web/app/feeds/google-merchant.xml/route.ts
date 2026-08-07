import { getAllProducts, type SeoProduct } from "../../../lib/seo/catalogue"
import { BRAND, SITE_URL, absolute } from "../../../lib/seo/site"

/**
 * Google Merchant Center product feed — RSS 2.0 with the g: namespace (plan W8).
 *
 * Point Merchant Center at https://littlestepz.in/feeds/google-merchant.xml
 * (Products -> Feeds -> scheduled fetch). Revalidates hourly.
 *
 * Products flagged `noindex`, or with no image, are skipped. When a product has
 * no GTIN/MPN we emit `g:identifier_exists=no` so Merchant Center doesn't reject
 * it for missing identifiers. Brand falls back to the retailer, matching the
 * Product JSON-LD.
 */
export const revalidate = 3600

const xmlEscape = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")

const money = (v: string | number) => `${Number(v).toFixed(2)} INR`

function itemXml(p: SeoProduct): string {
  const image = p.images?.[0]?.url
  if (!image) return "" // Merchant Center requires g:image_link

  const link = absolute(`/products/${p.slug}`)
  const brand = (p.brand || BRAND).trim()
  const desc = (p.description || p.name).replace(/\s+/g, " ").trim().slice(0, 5000)
  const onSale =
    p.salePrice != null && Number(p.salePrice) > 0 && Number(p.salePrice) < Number(p.price)
  const hasIdentifier = !!(p.gtin?.trim() || p.mpn?.trim())

  const lines = [
    `<g:id>${xmlEscape(p.slug)}</g:id>`,
    `<title>${xmlEscape(p.name)}</title>`,
    `<description>${xmlEscape(desc)}</description>`,
    `<link>${xmlEscape(link)}</link>`,
    `<g:image_link>${xmlEscape(image)}</g:image_link>`,
    `<g:availability>${p.inStock ? "in_stock" : "out_of_stock"}</g:availability>`,
    `<g:price>${money(p.price)}</g:price>`,
    onSale ? `<g:sale_price>${money(p.salePrice as string)}</g:sale_price>` : "",
    `<g:brand>${xmlEscape(brand)}</g:brand>`,
    p.gtin?.trim() ? `<g:gtin>${xmlEscape(p.gtin.trim())}</g:gtin>` : "",
    p.mpn?.trim() ? `<g:mpn>${xmlEscape(p.mpn.trim())}</g:mpn>` : "",
    `<g:condition>${xmlEscape((p.condition || "new").toLowerCase())}</g:condition>`,
    hasIdentifier ? "" : `<g:identifier_exists>no</g:identifier_exists>`,
    p.category?.name ? `<g:product_type>${xmlEscape(p.category.name)}</g:product_type>` : "",
  ].filter(Boolean)

  return `<item>\n${lines.join("\n")}\n</item>`
}

export async function GET() {
  const products = await getAllProducts()
  const items = products
    .filter((p) => !p.noindex)
    .map(itemXml)
    .filter(Boolean)
    .join("\n")

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>${xmlEscape(BRAND)} — Product Feed</title>
<link>${SITE_URL}</link>
<description>${xmlEscape(BRAND)} product feed for Google Merchant Center.</description>
${items}
</channel>
</rss>`

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}
