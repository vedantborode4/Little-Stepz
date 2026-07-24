import type { MetadataRoute } from "next"
import { ROBOTS_BLOCKED, SITE_URL } from "../lib/seo/site"

/**
 * Serves /robots.txt (proposal §4.1 — currently HTTP 404 in production).
 *
 * AI crawlers are split deliberately into two groups:
 *   - Citation/search bots are allowed: they drive AI Overviews, ChatGPT Search
 *     and Perplexity referrals, which is the point of the GEO work stream.
 *   - Training-corpus bots (Google-Extended, CCBot) are listed separately so the
 *     client can make that call independently — allowing them permits model
 *     training on the catalogue and earns no referral traffic in return.
 *
 * TODO(client): confirm the training-bot stance, then delete whichever block loses.
 */

// Trailing slash so `/account` blocks `/account/*` without catching a future
// `/accountancy`. /cart, /checkout, /wishlist, /signin and /signup are
// deliberately NOT here — they carry meta noindex instead (see site.ts).
const disallow = ROBOTS_BLOCKED.map((p) => `${p}/`)

// Query-parameter views (filters, sort, pagination, search) — crawlable for
// discovery but never indexed; canonical tags collapse them onto clean URLs.
const paramDisallow = ["/*?*sort=", "/*?*page=", "/*?*search=", "/*?*priceMin=", "/*?*priceMax="]

const CITATION_BOTS = [
  "OAI-SearchBot", // ChatGPT Search index
  "ChatGPT-User", // live fetch when a user asks
  "PerplexityBot",
  "Perplexity-User",
  "ClaudeBot", // current Anthropic crawler — `anthropic-ai`/`Claude-Web` are retired
  "Claude-User",
  "Applebot-Extended",
  "Bingbot",
  "DuckDuckBot",
]

const TRAINING_BOTS = ["Google-Extended", "CCBot", "GPTBot", "Bytespider", "Amazonbot"]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...disallow, ...paramDisallow],
      },
      // Allowed: these send referral traffic back.
      ...CITATION_BOTS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow,
      })),
      // Allowed today. Flip `allow` to `disallow: "/"` if the client opts out of
      // AI training use — this does not affect AI Overviews or ChatGPT citations.
      ...TRAINING_BOTS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow,
      })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
