import type { Metadata } from "next"
import { BRAND, DESCRIPTION, OG_IMAGE, SITE_URL, absolute } from "./site"

/**
 * Google truncates titles around 60 characters. Page titles are passed in
 * without the store name; titleTag() adds " | Little Stepz" when it fits and
 * returns the result as an absolute title (see titleTag for why the root
 * layout's template is not relied on).
 */
const SUFFIX = ` | ${BRAND}`
const TITLE_MAX = 60
const TITLE_BUDGET = TITLE_MAX - SUFFIX.length // room left once " | Little Stepz" is added
const DESC_MAX = 155
const BRAND_SUFFIX_RE = new RegExp(`\\s*\\|\\s*${BRAND}$`, "i")

/** Cut at a word boundary and drop dangling separators. Never adds "…". */
export function fitWords(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max + 1)
  const space = cut.lastIndexOf(" ")
  return (space > max * 0.5 ? cut.slice(0, space) : clean.slice(0, max)).replace(/[\s—–\-:,;(|/&]+$/, "")
}

/**
 * Fit text into `max` characters without an ellipsis (audit LS-09 / LS-10).
 * A literal "…" in a title or meta description only makes the cut visible in
 * search results; ending on a whole sentence (or at least a whole word) reads as
 * finished copy. Prefers the last full sentence that keeps at least half the text.
 */
export function clamp(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim()
  if (clean.length <= max) return clean
  const head = clean.slice(0, max)
  const sentenceEnd = Math.max(head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("? "))
  if (sentenceEnd >= max * 0.5) return head.slice(0, sentenceEnd + 1)
  return fitWords(clean, max)
}

/**
 * The full <title> for a page (audit LS-09): never longer than 60 characters,
 * never ending in "…", with " | Little Stepz" added whenever it still fits.
 *
 * Built here and returned as an absolute title because the root layout's
 * `%s | Little Stepz` template never reached product or category pages:
 * app/products/layout.tsx sets a plain-string title, and a string title drops
 * the inherited template for every route below it. That is why no product title
 * on the live site carried the store name.
 */
export function titleTag(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim().replace(BRAND_SUFFIX_RE, "")
  if (clean.length <= TITLE_BUDGET) return `${clean}${SUFFIX}`
  if (clean.length <= TITLE_MAX) return clean
  return `${fitWords(clean, TITLE_BUDGET)}${SUFFIX}`
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
  const title = titleTag(opts.title)
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
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    robots: opts.noindex
      ? { index: false, follow: true }
      : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url,
      siteName: BRAND,
      locale: "en_IN",
      type: opts.type ?? "website",
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  }
}

/**
 * Fallback product title when the admin Meta Title is empty. Carries no store
 * name — titleTag() adds it when there is room. The category is appended only
 * when name + category still leave room for the store name; long names are
 * passed through whole so titleTag() can keep up to 60 characters of them.
 */
export function productMetaTitle(name: string, categoryName?: string): string {
  const clean = name.replace(/\s+/g, " ").trim()
  if (categoryName) {
    const withCat = `${clean} — ${categoryName}`
    if (withCat.length <= TITLE_BUDGET) return withCat
  }
  return clean
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
