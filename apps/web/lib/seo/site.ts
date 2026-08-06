/**
 * Single source of truth for every SEO/brand constant.
 *
 * All NAP and social values below were read off the live production footer on
 * 21 Jul 2026 — they are NOT from the client's SEO pack, which guessed the social
 * handles and got all of them wrong (it says /littlestepz, the real accounts are
 * /littlestepzofficial).
 *
 * Items marked TODO(client) are blocked on a decision — see
 * tasks/seo-geo-implementation.md §7. Change them here and the whole site follows.
 */

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://littlestepz.in"

export const BRAND = "Little Stepz"

/**
 * TODO(client): positioning is currently contradictory in production — the footer
 * says children's educational toys, the hero says "India's #1 Store for RC Cars".
 * This line resolves it toward the proposal §5 recommendation: geo-anchored,
 * category-rich, and defensible under the ASCI code (no "#1", no "best").
 */
export const TAGLINE = "Hyderabad's Premium Destination for Toys, Diecast & Collectibles"

export const DESCRIPTION =
  "Shop premium toys, diecast models, RC cars and collectibles at Little Stepz. " +
  "Officially licensed Ferrari, Lamborghini, McLaren and Bugatti RC cars, Hot Wheels " +
  "premium sets, building blocks and Stanley tumblers. Delivered across India."

export const CONTACT = {
  phone: "+91 99206 34567",
  phoneHref: "+919920634567",
  /** TODO(client): production footer says this; the SEO pack says littlestepzpvtltd@gmail.com. Confirm one. */
  email: "Support@littlestepz.in",
  /** No street address is published anywhere. LocalBusiness schema stays off until we have one. */
  locality: "Hyderabad",
  region: "Telangana",
  country: "IN",
} as const

/** Verified live 21 Jul 2026. Facebook set to the canonical page URL (client-confirmed). */
export const SOCIALS = [
  "https://www.instagram.com/littlestepzofficial",
  "https://www.facebook.com/LittleStepzOfficial/",
  "https://x.com/LittlestepzOff",
  "https://youtube.com/@littlestepzofficial",
  "https://www.threads.com/@littlestepzofficial",
  "https://whatsapp.com/channel/0029VbD0g0j29753jCnp7U31",
]

export const LOGO = `${SITE_URL}/logo.webp`
export const OG_IMAGE = `${SITE_URL}/opengraph-image`

/**
 * GA4 measurement ID. Overridable per-environment so preview and local builds
 * can point at a test property (or unset it entirely to disable tracking).
 */
export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "G-EWT0G2CD9X"

/**
 * Two different tools for two different problems — do not merge these lists.
 *
 * BLOCKED: never crawled. Private or transactional areas that are not linked
 * from public navigation, so there is no risk of Google indexing a URL-only
 * entry from an external link.
 */
export const ROBOTS_BLOCKED = [
  "/admin",
  "/account",
  "/affiliate",
  "/api",
  "/order-payment",
  "/order-success",
  "/pre-orders/pay",
  "/profile",
  "/ref",
]

/**
 * NOINDEXED: crawlable but not indexed. These ARE linked from the navbar and
 * footer, so Googlebot will find them regardless. Blocking them in robots.txt
 * would be counter-productive — a disallowed URL can still be indexed from its
 * inbound links, and the crawler never reads the noindex that would have
 * stopped it. Letting it crawl and see `noindex` is what actually removes them.
 */
export const NOINDEX_ROUTES = [
  "/cart",
  "/checkout",
  "/wishlist",
  "/signin",
  "/signup",
]

/**
 * Categories with zero products as of 21 Jul 2026. Empty category pages are thin
 * content — excluded from the sitemap and set to noindex,follow until stocked.
 * Re-check before each release; sitemap.ts also filters on live product count.
 */
export const EMPTY_CATEGORIES = ["anime", "e-learning-toys", "transformers"]

export const absolute = (path: string) =>
  `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`
