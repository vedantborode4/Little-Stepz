import type { Metadata } from "next"
import { BRAND, DESCRIPTION, OG_IMAGE, SITE_URL, absolute } from "./site"

/**
 * Google truncates titles around 60 characters. The root layout sets a
 * `%s | Little Stepz` template, so every page title gets the brand appended
 * automatically — page titles must therefore NOT repeat the brand, and must be
 * budgeted against the space the suffix will take.
 */
const SUFFIX_LEN = BRAND.length + 3 // " | Little Stepz"
const TITLE_BUDGET = 60 - SUFFIX_LEN
const DESC_MAX = 155

/** Trim to a word boundary rather than cutting mid-word. */
export function clamp(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  const space = cut.lastIndexOf(" ")
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s—–-]+$/, "")}…`
}

export function pageMetadata(opts: {
  title: string
  description: string
  path: string
  image?: string
  /** Set only for images we know are 1200x630. Product photos are not. */
  imageSized?: boolean
  noindex?: boolean
  type?: "website" | "article"
}): Metadata {
  const title = clamp(opts.title, TITLE_BUDGET)
  const description = clamp(opts.description, DESC_MAX)
  const url = absolute(opts.path)
  const image = opts.image ?? OG_IMAGE
  const sized = opts.imageSized ?? !opts.image

  // Declaring dimensions we haven't verified makes scrapers render a broken
  // card, so only the generated OG image (known 1200x630) gets width/height.
  const ogImage = sized
    ? { url: image, width: 1200, height: 630, alt: title }
    : { url: image, alt: title }

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: opts.noindex
      ? { index: false, follow: true }
      : { index: true, follow: true },
    openGraph: {
      title: `${title} | ${BRAND}`,
      description,
      url,
      siteName: BRAND,
      locale: "en_IN",
      type: opts.type ?? "website",
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${BRAND}`,
      description,
      images: [image],
    },
  }
}

/**
 * Product titles carry no brand — the root template appends it. Category is
 * appended only when the name is short enough to leave room for it.
 */
export function productMetaTitle(name: string, categoryName?: string): string {
  const clean = name.replace(/\s+/g, " ").trim()
  if (categoryName) {
    const withCat = `${clean} — ${categoryName}`
    if (withCat.length <= TITLE_BUDGET) return withCat
  }
  return clamp(clean, TITLE_BUDGET)
}

/** Detects the spec-sheet descriptions used throughout this catalogue. */
function isSpecDump(text: string): boolean {
  return (text.match(/[A-Za-z][A-Za-z ]{2,20}:\s/g) ?? []).length >= 3
}

/** Pulls a labelled value ("Scale: 1:14 Scale") out of a spec-sheet blob. */
function specValue(text: string, label: string): string | null {
  const m = text.match(new RegExp(`${label}:\\s*([^A-Z]*?)(?=\\s+[A-Z][A-Za-z ]{2,20}:|$)`))
  return m?.[1]?.trim() || null
}

/**
 * Most product descriptions in this catalogue are spec sheets
 * ("Brand: Ferrari Scale: 1:14 Vehicle Type: ..."). Pasted raw into a meta
 * description that reads as machine output and kills click-through, so we
 * compose a sentence from the same facts instead.
 */
export function productMetaDescription(
  description: string | null,
  name: string,
  price?: string,
): string {
  const text = description?.replace(/\s+/g, " ").trim() ?? ""
  const priceBit = price ? ` ₹${Number(price).toLocaleString("en-IN")}.` : ""

  if (text && !isSpecDump(text)) return clamp(text, DESC_MAX)

  if (text) {
    const facts = [specValue(text, "Scale"), specValue(text, "Vehicle Type")]
      .filter(Boolean)
      .join(", ")
    const factBit = facts ? ` ${facts}.` : ""
    return clamp(
      `${name}.${factBit}${priceBit} Buy online at ${BRAND} — authentic, directly imported, delivered across India.`,
      DESC_MAX,
    )
  }

  return clamp(
    `Buy ${name} at ${BRAND}.${priceBit} Authentic, directly imported and delivered across India.`,
    DESC_MAX,
  )
}

export const ROOT_METADATA: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND} — Premium Toys, Diecast, RC Cars & Collectibles`,
    template: `%s | ${BRAND}`,
  },
  description: DESCRIPTION,
  applicationName: BRAND,
  alternates: { canonical: SITE_URL },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  openGraph: {
    type: "website",
    siteName: BRAND,
    locale: "en_IN",
    url: SITE_URL,
    title: `${BRAND} — Premium Toys, Diecast, RC Cars & Collectibles`,
    description: DESCRIPTION,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: BRAND }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND} — Premium Toys, Diecast, RC Cars & Collectibles`,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
  // TODO(client): paste the Search Console verification token when the property is created.
  // verification: { google: "..." },
}
