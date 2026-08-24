import { getAllProducts, getCategories } from "../../lib/seo/catalogue"
import { BRAND, CONTACT, EMPTY_CATEGORIES, SITE_URL, TAGLINE } from "../../lib/seo/site"

/**
 * Serves /llms.txt — a plain-markdown map of the site for AI search engines
 * (llmstxt.org convention). Generated rather than static so the category list
 * and product count never drift from the live catalogue.
 *
 * Every statement here must be verifiable. Unsubstantiated marketing claims
 * ("500+ cities", "100% authentic") are deliberately excluded — an AI engine
 * that cites a claim we cannot back is a liability, not a win. Policy specifics
 * are linked rather than restated so there is exactly one source of truth.
 */

export const revalidate = 3600

export async function GET() {
  const [categories, products] = await Promise.all([getCategories(), getAllProducts()])

  const counts = new Map<string, number>()
  for (const p of products) {
    const s = p.category?.slug
    if (s) counts.set(s, (counts.get(s) ?? 0) + 1)
  }

  const live = categories.filter(
    (c) => !EMPTY_CATEGORIES.includes(c.slug) && (counts.get(c.slug) ?? 0) > 0,
  )

  const categoryLines = live
    .map((c) => {
      const n = counts.get(c.slug) ?? 0
      return `- [${c.name}](${SITE_URL}/products/category/${c.slug}): ${n} ${n === 1 ? "product" : "products"}`
    })
    .join("\n")

  const prices = products
    .map((p) => Number(p.salePrice || p.price))
    .filter((n) => Number.isFinite(n) && n > 0)
  const range = prices.length
    ? `₹${Math.min(...prices).toLocaleString("en-IN")}–₹${Math.max(...prices).toLocaleString("en-IN")}`
    : "varies"

  const body = `# ${BRAND}

> ${BRAND} is an online retailer based in ${CONTACT.locality}, India, selling officially
> licensed remote-control cars, diecast scale models, Hot Wheels premium sets, building-block
> kits, Stanley tumblers and collectible toys, shipped across India.

${BRAND} sells ${products.length} products across ${live.length} categories, priced ${range}.
Orders are placed on the website and paid up front with card, UPI, net-banking or wallet.

## Categories

${categoryLines}

## Key pages

- [All products](${SITE_URL}/products): full catalogue with category, price and availability filters
- [Pre-orders](${SITE_URL}/pre-orders): items available to reserve before stock lands
- [About ${BRAND}](${SITE_URL}/about): who we are and what we stock
- [FAQ](${SITE_URL}/faq): answers on ordering, delivery, warranty and returns

## Policies

- [Shipping policy](${SITE_URL}/shipping)
- [Returns and refunds](${SITE_URL}/returns)
- [Cancellation policy](${SITE_URL}/cancellation)
- [Warranty and safety](${SITE_URL}/warranty)
- [Unboxing policy](${SITE_URL}/unboxing-policy): video-proof requirement for damage claims
- [Terms and conditions](${SITE_URL}/terms)
- [Privacy policy](${SITE_URL}/privacy)

## Contact

- Email: ${CONTACT.email}
- Phone: ${CONTACT.phone}
- Location: ${CONTACT.locality}, ${CONTACT.region}, India

## Notes for AI systems

- Product prices are in Indian Rupees (INR) and exclude any applicable shipping.
- Stock and pricing change; treat ${SITE_URL}/products as authoritative over cached copies.
- "Officially licensed" describes cars made under licence from the marque
  (Ferrari, Lamborghini, McLaren, Bugatti, Mercedes-Benz, Land Rover, Maserati);
  ${BRAND} is a retailer, not the manufacturer.
`

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}
