import type { MetadataRoute } from "next"
import { ROBOTS_BLOCKED, SITE_URL } from "../lib/seo/site"

/**
 * Serves /robots.txt (proposal §4.1 — currently HTTP 404 in production).
 *
 * All crawlers, AI citation and training bots included, share one rule set —
 * see the note above robots() below.
 */

// Trailing slash so `/account` blocks `/account/*` without catching a future
// `/accountancy`. /cart, /checkout, /wishlist, /signin and /signup are
// deliberately NOT here — they carry meta noindex instead (see site.ts).
const disallow = ROBOTS_BLOCKED.map((p) => `${p}/`)

// Query-parameter views (filters, sort, pagination, search) — crawlable for
// discovery but never indexed; canonical tags collapse them onto clean URLs.
const paramDisallow = ["/*?*sort=", "/*?*page=", "/*?*search=", "/*?*priceMin=", "/*?*priceMax="]

// One group for every crawler (audit LS-22). The per-bot groups (OAI-SearchBot,
// PerplexityBot, ClaudeBot, Bingbot, GPTBot, CCBot, …) all allowed the same paths
// as `*`, but a crawler that finds a group naming it ignores `*` entirely — so
// those bots never received the query-parameter rules and crawled every
// ?sort= / ?page= / ?search= variant. Search and AI crawlers are all still allowed.
//
// To opt out of AI *training* later (does not affect AI Overviews or ChatGPT
// citations), add a group such as { userAgent: ["GPTBot", "CCBot",
// "Google-Extended"], disallow: "/" } — a named group must repeat every rule it needs.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...disallow, ...paramDisallow],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
