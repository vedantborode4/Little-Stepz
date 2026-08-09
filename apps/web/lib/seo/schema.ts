import { BRAND, CONTACT, DESCRIPTION, LOGO, SITE_URL, SOCIALS, absolute } from "./site"

/**
 * Schema.org JSON-LD builders (proposal §4.4).
 *
 * Rule applied throughout: omit a property entirely rather than emit a null,
 * an empty string or a zero. Google treats a present-but-empty value as an
 * error; an absent optional property is simply absent.
 */

type Json = Record<string, unknown>

const ORG_ID = `${SITE_URL}/#organization`
const SITE_ID = `${SITE_URL}/#website`

export function organizationSchema(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID,
    name: BRAND,
    url: SITE_URL,
    logo: { "@type": "ImageObject", url: LOGO },
    description: DESCRIPTION,
    email: CONTACT.email,
    telephone: CONTACT.phone,
    address: {
      "@type": "PostalAddress",
      addressLocality: CONTACT.locality,
      addressRegion: CONTACT.region,
      addressCountry: CONTACT.country,
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      telephone: CONTACT.phone,
      email: CONTACT.email,
      areaServed: "IN",
      availableLanguage: ["en", "hi", "te"],
    },
    sameAs: SOCIALS,
  }
}

export function websiteSchema(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": SITE_ID,
    name: BRAND,
    url: SITE_URL,
    publisher: { "@id": ORG_ID },
    inLanguage: "en-IN",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/products?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  }
}

export interface ProductSchemaInput {
  name: string
  slug: string
  description?: string | null
  images?: string[]
  price: string | number
  salePrice?: string | number | null
  inStock: boolean
  categoryName?: string
  brand?: string | null
  gtin?: string | null
  mpn?: string | null
  condition?: string | null
  rating?: { value: number; count: number } | null
}

const CONDITION_URL: Record<string, string> = {
  new: "https://schema.org/NewCondition",
  used: "https://schema.org/UsedCondition",
  refurbished: "https://schema.org/RefurbishedCondition",
}
const conditionUrl = (c?: string | null): string =>
  CONDITION_URL[(c || "new").toLowerCase()] ?? "https://schema.org/NewCondition"

export function productSchema(p: ProductSchemaInput): Json {
  const price = String(p.salePrice ?? p.price)
  // Merchant Center + rich results recommend a price-validity window; roll ~1yr.
  const priceValidUntil = new Date(Date.now() + 365 * 86_400_000)
    .toISOString()
    .slice(0, 10)
  const schema: Json = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${absolute(`/products/${p.slug}`)}#product`,
    name: p.name,
    url: absolute(`/products/${p.slug}`),
    sku: p.slug,
    offers: {
      "@type": "Offer",
      url: absolute(`/products/${p.slug}`),
      priceCurrency: "INR",
      price,
      priceValidUntil,
      availability: p.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: conditionUrl(p.condition),
      seller: { "@id": ORG_ID },
    },
  }

  if (p.description?.trim()) schema.description = p.description.trim()
  if (p.images?.length) schema.image = p.images
  if (p.categoryName) schema.category = p.categoryName

  // Brand is a Merchant Center requirement and a rich-result differentiator.
  // Falls back to the retailer only when the manufacturer is unknown.
  schema.brand = { "@type": "Brand", name: p.brand?.trim() || BRAND }

  if (p.gtin?.trim()) schema.gtin = p.gtin.trim()
  if (p.mpn?.trim()) schema.mpn = p.mpn.trim()

  // Only ever emitted with real approved reviews — never zeros.
  if (p.rating && p.rating.count > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: p.rating.value,
      reviewCount: p.rating.count,
      bestRating: 5,
      worstRating: 1,
    }
  }

  return schema
}

export function breadcrumbSchema(
  crumbs: { name: string; path: string }[],
): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absolute(c.path),
    })),
  }
}

export function collectionPageSchema(opts: {
  name: string
  description: string
  path: string
  items?: { name: string; slug: string }[]
}): Json {
  const schema: Json = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: opts.name,
    description: opts.description,
    url: absolute(opts.path),
    isPartOf: { "@id": SITE_ID },
  }
  if (opts.items?.length) {
    schema.mainEntity = {
      "@type": "ItemList",
      numberOfItems: opts.items.length,
      itemListElement: opts.items.map((it, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: it.name,
        url: absolute(`/products/${it.slug}`),
      })),
    }
  }
  return schema
}

export function faqSchema(qa: { question: string; answer: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qa.map((x) => ({
      "@type": "Question",
      name: x.question,
      acceptedAnswer: { "@type": "Answer", text: x.answer },
    })),
  }
}
