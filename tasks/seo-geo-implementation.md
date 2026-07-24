# SEO + GEO Implementation — apps/web · apps/backend · packages/db

Development plan for the engagement quoted in `Little-Stepz-SEO-Ecommerce-Proposal.docx`
(ref **LS-SEO-2026-01**), extended with Generative Engine Optimization (GEO) for AI search
surfaces — AI Overviews, ChatGPT Search, Perplexity, Bing Copilot.

Target domain: **littlestepz.in** · Stack: Next.js 16 (App Router, Turbopack) · Express 5 · Prisma 6 / Postgres

Section refs like `§4.1` point at the proposal's Scope of Work. GEO work streams (**W9–W10**)
are **not in the signed proposal** — see §7 before starting them.

> ⚠ **Root cause found and fixed — see §10.** `AuthProvider` returned `null` on every server
> render, so the entire site body was absent from the HTML on every route. That single line,
> not the architecture, is why production served zero `<h1>` and zero structured data. Much of
> W1 as originally scoped is no longer needed; the priority order in §5 has changed.

> ⚠ **Read §9 too.** The client-supplied SEO pack in `E:\Little_stepz\SEO\` (20 documents)
> describes a **different website** — different stack, different data layer, different routes,
> and it reports as ✅ done a list of things that do not exist in this repo or on production.
> Do not action it as a work order. §9 separates what is reusable from what is void.

---

## 1. Audit findings

Verified against the codebase on 21 Jul 2026, not assumed. This confirms and extends the
proposal's §3 external observations.

| # | Finding | Evidence | Proposal § |
|---|---|---|---|
| F1 | **Commercial pages are client-rendered.** Home, listing, product detail, category and pre-order pages are `"use client"` and fetch in `useEffect`. Crawlers get an empty shell. | `app/page.tsx:1`, `app/products/[slug]/page.tsx:1,30-48`, `app/products/category/[slug]/page.tsx`, `app/products/page.tsx`, `app/pre-order/[slug]/page.tsx` | §3, §4.1 |
| F2 | **Zero `generateMetadata` in the app.** A client component cannot export metadata, so no product or category page can have a unique title, description, canonical or OG tag. | `grep generateMetadata app/ → 0 hits` | §4.2 |
| F3 | **Root metadata is a two-line stub.** No `metadataBase`, title template, OG, Twitter, canonical or robots directives. | `app/layout.tsx:42-45` (`title: "Little Stepz"`, `description: "Toys store"`) | §4.2 |
| F4 | **No `robots.txt`.** No `app/robots.ts`. | `find app -name 'robots*' → none` | §3, §4.1 |
| F5 | **No `sitemap.xml`.** No `app/sitemap.ts`. | `find app -name 'sitemap*' → none` | §3, §4.1 |
| F6 | **No structured data anywhere.** No JSON-LD of any type. | `grep 'application/ld+json' → 0 hits` | §4.4 |
| F7 | **18 raw `<img>` tags** bypass `next/image` — no lazy loading, no AVIF/WebP, no intrinsic sizing (CLS risk). 7 files use `next/image`. | `grep -c '<img '` | §4.5 |
| F8 | **Razorpay `checkout.js` loads on every route**, including the homepage, via the root layout. Only checkout and payment routes need it. | `app/layout.tsx:66-69` | §4.5 |
| F9 | **`next.config.js` has no image `formats`.** Cloudinary is allow-listed but AVIF/WebP negotiation is left at default. | `next.config.js:4-19` | §4.5 |
| F10 | **Product model has no SEO or feed fields** — no `metaTitle`, `metaDescription`, `brand`, `gtin`, `mpn`, `condition`. Merchant Center cannot be fed without these. | `packages/db/prisma/schema.prisma` — `model Product` | §4.7 |
| F11 | **Category model has no meta fields.** `description` exists and can serve as collection intro copy. | `model Category` | §4.3 |
| F12 | **Homepage H1 makes an unverifiable superiority claim** — the exact ASCI risk called out in proposal §5. It sits in the single highest-weighted on-page element. | `components/home/HeroFallback.tsx:32` — `India&apos;s #1 Store for` | §4.8, §5 |
| F13 | **Hardcoded trust stats** need client verification before they ship as crawlable claims. | `components/home/HeroFallback.tsx:7-10` (`500+` cities, `22+` products, `100%`, `48h`), `components/home/AboutUs.tsx:12,23,56` | §4.8 |
| F14 | **Breadcrumb UI exists but emits no schema**, and is client-only (driven by a Zustand store). | `components/common/Breadcrumbs.tsx:1,11-12` | §4.4 |
| F15 | **`api-client.ts` is browser-coupled** — `localStorage` tokens, `window.location` redirects. It cannot be reused for server-side fetching. | `lib/api-client.ts:8-11,92` | §4.1 |
| F16 | **`ProductImage.alt` exists in the DB but is optional** and has no admin-side enforcement. | `model ProductImage` — `alt String?` | §4.2 |
| F17 | **No `not-found.tsx`**, so 404s render the framework default and return no branded/indexable signal. | `find app -name 'not-found.tsx' → 0` | §4.1 |
| F18 | **`middleware.ts` guards `/dashboard`, a route that does not exist.** Dead code. Next 16 also deprecates the filename in favour of `proxy.ts`. | `middleware.ts:8`, dev-server warning | — |
| F19 | **Review data supports `aggregateRating`** — `rating: Int` + `isApproved`, indexed on `[productId, rating]`. No API exposes the aggregate yet. | `model Review` | §4.4 |

### The one blocker

**F1 + F2 gate roughly 60% of the proposal.** Until the commercial routes render on the
server, §4.2 (unique titles/meta per page), §4.4 (Product & Breadcrumb schema) and most of
§4.3 are not implementable — not "harder", *not possible*. Google can execute JavaScript on
a delayed second pass, but metadata is read from the initial HTML response and never
re-read.

For GEO the same finding is terminal rather than merely costly: **GPTBot, ClaudeBot,
PerplexityBot and OAI-SearchBot do not execute JavaScript at all.** Today the entire
catalogue is invisible to every AI search surface.

Do **W1** first. Everything else depends on it.

---

## 2. Architecture decision — server shell + client island

Do **not** rewrite the pages. Split each commercial route in two:

```
app/products/[slug]/
  page.tsx              ← NEW server component: fetch, generateMetadata, JSON-LD
  ProductDetailsClient.tsx ← existing file, renamed; takes `initialProduct` as a prop
```

The server component fetches and owns metadata; the existing client component keeps every
interactive behaviour (variant selection, cart, wishlist, reviews) but receives its first
paint as props instead of a `useEffect` round-trip. Interactivity is unchanged; the initial
HTML becomes complete.

Side benefit: the product `useEffect` waterfall disappears, which is a direct LCP win
toward §4.5.

**A separate server fetch layer is required** (F15). Add `lib/server/api.ts` using `fetch()`
with Next's cache directives — never import `api-client.ts` into a server component.

```ts
// lib/server/api.ts — server-only, no auth, public catalogue reads
import "server-only"

const BASE = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL

export async function getProduct(slug: string) {
  const res = await fetch(`${BASE}/products/${slug}`, {
    next: { revalidate: 300, tags: [`product:${slug}`] },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`product ${slug}: ${res.status}`)
  return (await res.json()).data
}
```

Public catalogue endpoints already exist and need no auth
(`apps/backend/src/routes/product.routes.ts`):

```
GET /products                       list + pagination (page, limit, category, sort)
GET /products/:slug                 detail
GET /products/category/:categorySlug
GET /products/search
GET /products/:productId/reviews
```

**Routes to convert (in priority order):**

| Route | File | Why |
|---|---|---|
| `/products/[slug]` | `app/products/[slug]/page.tsx` | Highest commercial value; needs Product schema |
| `/products/category/[slug]` | `app/products/category/[slug]/page.tsx` | Primary ranking asset per §4.3 |
| `/products` | `app/products/page.tsx` | Catalogue entry point |
| `/` | `app/page.tsx` | Brand + Organization/WebSite schema |
| `/pre-order/[slug]` | `app/pre-order/[slug]/page.tsx` | Indexable product-like page |

**Leave as client components** — they are correctly `noindex` and behind auth:
`/cart`, `/checkout`, `/profile`, `/wishlist`, `/account/*`, `/admin/*`, `/affiliate/*`,
`/order-*`, `/pre-orders/pay/*`, `/ref/*`, `/signin`, `/signup`.

**Caching:** `revalidate: 300` on catalogue reads. Optional follow-up — have admin product
mutations POST to a Next revalidation route so edits go live immediately instead of within
5 minutes.

---

## 3. Data model changes

One migration in `packages/db`, plus admin UI and validation to populate the fields.
`Product.updatedAt` already exists and feeds sitemap `<lastmod>`.

```prisma
model Product {
  // ── SEO ──
  metaTitle       String?
  metaDescription String?

  // ── Google Merchant Center (§4.7) ──
  brand           String?
  gtin            String?   // EAN/UPC/ISBN — required unless the item is MPN-only
  mpn             String?
  condition       ProductCondition @default(NEW)
  googleCategory  String?   // Google product taxonomy id

  @@index([brand])
}

enum ProductCondition { NEW REFURBISHED USED }

model Category {
  metaTitle       String?
  metaDescription String?
  // `description` already exists — reuse as collection intro copy (§4.3)
}
```

Dependent work:
- Zod schemas in `packages/zod-schema` for the new fields.
- Admin product form (`app/admin/products/new`, `app/admin/products/[id]`) — add an
  "SEO & Feed" section. Show a live character counter (title ≤ 60, description ≤ 155).
- **Make `ProductImage.alt` required in the admin form** (F16). Keep the column nullable for
  the existing rows; enforce on write and backfill.
- Backfill script for the current catalogue — brand and GTIN will need client input (§7).

**Fallback rule** (implement once, in a helper): when `metaTitle` is null, derive
`{name} — {category} | Little Stepz`; when `metaDescription` is null, take the first 155
chars of `description`. Never ship an empty tag.

---

## 4. Work streams

### W1 — Server rendering foundation `§4.1` **[blocker — do first]**

- [ ] `lib/server/api.ts` — `getProduct`, `getProducts`, `getCategory`, `getProductsByCategory`, `getCategoryTree`
- [ ] Add `SITE_URL=https://littlestepz.in` and `API_URL` to `apps/web/.env` + `.env.sample`
- [ ] Convert `/products/[slug]` → server shell + `ProductDetailsClient.tsx`
- [ ] Convert `/products/category/[slug]`
- [ ] Convert `/products` (keep filters/sort client-side; server-render page 1)
- [ ] Convert `/` — hero and static sections server-rendered
- [ ] Convert `/pre-order/[slug]`
- [ ] `app/not-found.tsx` — branded 404 (F17)
- [ ] Delete or fix the dead `/dashboard` guard; rename `middleware.ts` → `proxy.ts` (F18)
- [ ] Verify: `curl -s localhost:3001/products/<slug> | grep -c '<h1'` returns ≥ 1 **with JS disabled**

### W2 — Crawl foundation `§4.1`

- [ ] `app/robots.ts` — allow the catalogue; `Disallow: /admin, /account, /checkout, /cart, /profile, /wishlist, /affiliate, /order-payment, /order-success, /pre-orders/pay, /ref, /signin, /signup`; reference the sitemap
- [ ] `app/sitemap.ts` — static pages + all products + all categories, with `lastModified` from `updatedAt`. Paginate the backend fetch; add `generateSitemaps` if the catalogue passes ~5k URLs
- [ ] Canonical on every indexable route via `alternates.canonical`
- [ ] Facet/sort/pagination handling (§4.3): canonical strips `?sort=`/`?page=`; `robots: { index: false, follow: true }` on filtered views to prevent index bloat
- [ ] 301 map for any legacy URLs — **needs the client's current URL list** (§7)

### W3 — On-page metadata `§4.2`

- [ ] Rewrite root `metadata` in `app/layout.tsx`: `metadataBase`, `title.template` (`%s | Little Stepz`), `title.default`, description, `openGraph`, `twitter`, `robots`, `alternates`
- [ ] `generateMetadata` on all five converted routes, using the F10 fields with the §3 fallback rule
- [ ] `app/opengraph-image.tsx` (site default) + per-product OG using the primary product image
- [ ] Audit the 8 existing policy pages — their metadata predates the template, so re-check for duplicate titles
- [ ] Heading audit: exactly one `<h1>` per page across the 37 current `<h1>` uses; verify H2/H3 nesting on the product and category templates
- [ ] ALT text: enforce in admin (§3), backfill the catalogue, fix the 4 `alt=""` instances that are not decorative

### W4 — Structured data `§4.4`

Build `components/seo/JsonLd.tsx` (a `<script type="application/ld+json">` wrapper) and
emit **from server components only**.

- [ ] `Organization` — name, logo, `sameAs` social profiles, `contactPoint` (root layout)
- [ ] `WebSite` + `SearchAction` sitelinks search box → `/products?search={q}` (root layout)
- [ ] `Product` — `name`, `image`, `description`, `sku`, `brand`, `gtin`, plus `offers` (`price`, `priceCurrency: INR`, `availability` from `inStock`, `itemCondition`)
- [ ] `AggregateRating` on Product — **requires a new backend aggregate** (F19); omit the property entirely when there are no approved reviews rather than emitting zeros
- [ ] `BreadcrumbList` — server-rendered, sourced from the category path, not the Zustand store (F14)
- [ ] `LocalBusiness` (Hyderabad) — feeds both local pack and GEO entity grounding; **needs verified NAP** (§7)
- [ ] `FAQPage` on `/faq`
- [ ] Validate every type against Google Rich Results Test and schema.org

### W5 — E-commerce page quality `§4.3`

- [ ] Category intro copy rendered server-side from `Category.description`
- [ ] Keyword research → title/meta/H1 mapping per category and per product (**deliverable, not code**)
- [ ] De-duplicate manufacturer descriptions; add original copy per §4.3
- [ ] Internal linking: related products, category cross-links, breadcrumb links — all as real crawlable `<a href>`, server-rendered
- [ ] Pagination: `rel` links or a crawlable "View all" path

### W6 — Performance & Core Web Vitals `§4.5`

- [ ] Move Razorpay `checkout.js` out of the root layout into checkout/payment routes only (F8) — the single biggest INP/TBT win on the homepage
- [ ] Convert the 18 raw `<img>` to `next/image` with explicit `width`/`height` (F7)
- [ ] `next.config.js`: add `formats: ["image/avif", "image/webp"]`, tune `deviceSizes`
- [ ] `priority` on the LCP hero image; `loading="lazy"` everywhere below the fold
- [ ] Consider a Cloudinary loader (`f_auto,q_auto`) to push transcoding to the CDN
- [ ] Re-check the four Google fonts (Anton, Manrope, Sora, Orbitron — all in active use); subset rather than remove
- [ ] Baseline then target Lighthouse on `/`, `/products`, `/products/[slug]`, mobile + desktop

### W7 — Analytics & Google ecosystem `§4.6`

Dev-side only; account setup is the client's or the agency's (§7).

- [ ] GTM container in the root layout (`@next/third-parties/google`)
- [ ] GA4 e-commerce events — `view_item`, `view_item_list`, `add_to_cart`, `remove_from_cart`, `begin_checkout`, `add_payment_info`, `purchase`. Wire into the existing cart/checkout stores in `store/`
- [ ] `purchase` fires once, from the order-success route, keyed on order id — **guard against double-fire on refresh**
- [ ] GSC verification tag via `metadata.verification.google`
- [ ] Consent-mode defaults if the client wants EU traffic

### W8 — Google Merchant Center feed `§4.7`

- [ ] `app/feeds/google-merchant.xml/route.ts` — RSS 2.0 feed, public, no auth, hourly revalidate
- [ ] Map: `g:id`, `g:title`, `g:description`, `g:link`, `g:image_link`, `g:additional_image_link`, `g:availability`, `g:price` (INR), `g:sale_price`, `g:brand`, `g:gtin`/`g:mpn`, `g:condition`, `g:google_product_category`, `g:identifier_exists` when neither GTIN nor MPN is known
- [ ] Exclude soft-deleted (`deletedAt`) and out-of-stock-without-backorder items
- [ ] Variants as separate feed items with `g:item_group_id`
- [ ] Shipping/tax/returns are configured in the Merchant Center UI, not the feed

### W9 — GEO: AI crawler access **[not in proposal — see §7]**

- [ ] Explicit allow rules in `app/robots.ts` for `GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, `CCBot`, `Bingbot`
- [ ] **Confirm with the client** — allowing `Google-Extended`/`CCBot` permits AI training use, which is a business decision, not a technical default. Citation-only bots (`OAI-SearchBot`, `PerplexityBot`) can be allowed while training bots are blocked
- [ ] `app/llms.txt/route.ts` — a markdown map of the catalogue, key categories and policy pages
- [ ] Verify no CDN/WAF rule blocks these agents in production

### W10 — GEO: citability **[not in proposal — see §7]**

AI engines cite self-contained passages, so the unit of optimisation is the paragraph, not
the page.

- [ ] Product specs as a real server-rendered `<table>`, not a JS-built list — specs are the most-cited product passage
- [ ] Rewrite FAQ answers to be self-contained: each answer must name the subject ("Little Stepz ships…", never "We ship…") so an extracted passage still identifies the brand
- [ ] Add a short factual summary block near the top of each category page — entity, what it covers, price range, availability
- [ ] Entity consistency: brand name, Hyderabad address and phone identical across `Organization` schema, `LocalBusiness` schema, footer, `/about` and Google Business Profile — inconsistency is the most common cause of weak entity grounding
- [ ] `sameAs` links to every owned social profile
- [ ] Baseline brand-mention tracking across ChatGPT, Perplexity and AI Overviews for the target query set

### W11 — Brand positioning `§4.8`

- [ ] Replace the H1 claim at `components/home/HeroFallback.tsx:32` with the proposal §5 recommendation — **"Hyderabad's Premium Destination for Toys, Diecast & Collectibles"**
- [ ] The hero is banner-driven from admin with `HeroFallback` as fallback — **update both** the component and the live banner records, or the old claim survives in production
- [ ] Sub-headline per §5: "Handpicked diecast models, RC cars and collectible toys — delivered across India."
- [ ] Verify or remove the hardcoded stats in `HeroFallback.tsx:7-10` and `AboutUs.tsx:12,23,56` (F13) — under the ASCI code these need substantiation, same as "No.1"
- [ ] Geo-anchor the homepage copy and title for Hyderabad intent

---

## 5. Phasing

Maps to proposal §7. W1 is on the critical path for W3, W4, W5 and W10.

| Phase | Work streams | Proposal phase |
|---|---|---|
| **A — Foundation** | W1, W2, W11 + the §3 migration | Phase 1, Weeks 1–3 |
| **B — Metadata & schema** | W3, W4, W5 | Phase 1–2, Weeks 2–4 |
| **C — Performance & tracking** | W6, W7 | Phase 2, Weeks 3–5 |
| **D — Feed & GEO** | W8, W9, W10 | Phase 2 → 3 |
| **E — Ongoing** | Monitoring, content, rank tracking | Phase 3, retainer |

W11 lands in Phase A deliberately: it is cheap, it is a compliance risk while it ships, and
the copy needs to be final before W3 writes titles that quote it.

---

## 6. Acceptance criteria

Each is mechanically checkable. **Run the crawl checks with JavaScript disabled** — that is
what a non-rendering crawler sees.

| # | Criterion |
|---|---|
| A1 | `curl -s https://littlestepz.in/robots.txt` → 200, includes a `Sitemap:` line |
| A2 | `curl -s https://littlestepz.in/sitemap.xml` → 200, valid XML, contains every live product and category |
| A3 | Raw HTML of a product page contains the product name, price and description — no JS execution |
| A4 | Every indexable route has a unique `<title>` ≤ 60 chars and `<meta name="description">` ≤ 155 chars — zero duplicates across the site |
| A5 | Every indexable route has exactly one self-referencing `<link rel="canonical">` |
| A6 | Google Rich Results Test passes for Product, BreadcrumbList, Organization and FAQPage with no errors |
| A7 | Filtered/sorted URLs are `noindex, follow` and canonicalise to the clean URL |
| A8 | Lighthouse mobile ≥ 90 performance on `/`, `/products` and a product page; CWV in the green (LCP < 2.5s, INP < 200ms, CLS < 0.1) |
| A9 | Zero images without a non-empty `alt`, excluding genuinely decorative ones |
| A10 | GA4 DebugView shows the full funnel; `purchase` fires exactly once per order |
| A11 | Merchant Center feed fetches clean with zero blocking disapprovals |
| A12 | `curl -A "GPTBot" https://littlestepz.in/products/<slug>` returns full product HTML |
| A13 | `/llms.txt` returns 200 |
| A14 | GSC verified, sitemap submitted, priority URLs indexed |

---

## 7. Needs from the client / outside dev

### Already resolved — harvested from the live production footer (21 Jul 2026)

These were open blockers. They are now sourced from `littlestepz.in` itself, which outranks
both the proposal and the SEO pack as evidence. **Use these, not the SEO pack's values** —
the pack guessed the social handles and got every one of them wrong.

| Field | Live value | SEO pack said |
|---|---|---|
| Phone | `+91 99206 34567` | "NOT FOUND / update with real number" |
| Email | `Support@littlestepz.in` | `littlestepzpvtltd@gmail.com` ⚠ **conflict** |
| Location | "Hyderabad, India" (no street address) | not stated anywhere |
| Instagram | `instagram.com/littlestepzofficial` | `instagram.com/littlestepz` ❌ |
| X | `x.com/LittlestepzOff` | `@littlestepzin` ❌ |
| YouTube | `youtube.com/@littlestepzofficial` | `youtube.com/@littlestepz` ❌ |
| Threads | `threads.com/@littlestepzofficial` | not mentioned |
| WhatsApp | `whatsapp.com/channel/0029VbD0g0j29753jCnp7U31` | not mentioned |
| Facebook | `facebook.com/share/1BYNjMRyJJ/` | `facebook.com/littlestepz` ❌ |
| Categories (6) | `blocks`, `die-cast-cars`, `hyper-go-cars`, `licensed-cars`, `rc-cars`, `stanley-bottles` | invents `rock-crawlers`, `drift-cars`, `diecast-models` |

Two caveats before these go into `sameAs`: the Facebook value is a **share link, not a page
URL** — get the canonical page URL. And confirm whether `Support@littlestepz.in` or the
gmail address is the real customer-service address; they must not both be in circulation.

### Still blocking — chase at Phase 0 kickoff, not when the code is ready

1. **Brand + GTIN/MPN for the whole catalogue** (W8). Without identifiers Merchant Center
   rejects or throttles items. Requires either supplier data or `g:identifier_exists: no`
   per item, which reduces Shopping reach. The SEO pack confirms this data does not exist
   anywhere today.
2. **Street address, or an explicit decision to be online-only** (W4, W10). "Hyderabad,
   India" is not enough for `LocalBusiness` schema or a Google Business Profile. If there is
   no walk-in premises, drop `LocalBusiness` and rely on `Organization` + `areaServed` —
   do not invent an address.
3. **Legal entity name and GST/CIN** — unknown to both the proposal and the SEO pack.
4. **Substantiation for the stat claims** (F13, W11) — 500+ cities, 22+ products, 48h
   dispatch, 100% authentic. None of the four is evidenced anywhere in the SEO pack; "22+
   products" appears in no document at all. The pack's own competitor analysis argues
   against unproven superlatives.
5. **Resolve the shipping-threshold contradiction.** Live homepage says *free shipping above
   ₹499*; the SEO pack says *₹99 shipping, free above ₹999*. This has to be settled before
   it is written into `OfferShippingDetails` — wrong shipping data in Product schema is a
   Merchant Center disapproval risk, not just a copy inconsistency.
6. **Resolve the brand-positioning contradiction** (W11). Three different positions ship
   simultaneously today: the live footer says *"Safe, fun, and thoughtfully designed toys
   that help children learn through play"* (children's toys), the live hero says *"India's
   #1 Store for RC Cars & Collectibles"*, and the SEO pack insists *"This is NOT a toy
   store. It is a premium collector destination"* for adult collectors. These target
   different buyers and different keywords. **Pick one before W3 writes any titles** — this
   decision propagates into every title, meta description and schema description on the site.
7. **Pick the canonical tagline.** The pack carries two: "Every collection begins with a
   little step." and "Let The Fun Begin." The logo artwork on the live site uses the latter.
   The proposal §5 recommends a third. Someone has to choose.
8. **Legacy URL list** for the 301 map (W2) — needed only if the site has been live under
   different URLs.
6. **Google account access** — GSC, GA4, GTM, Merchant Center (proposal §4.6, §4.7 and
   Phase 0). Account creation and verification are not dev tasks; the dev hooks are in W7
   and W8.
7. **AI training-vs-citation decision** (W9) — whether `Google-Extended` and `CCBot` are
   allowed.
8. **Scope decision on W9–W10.** GEO is not in proposal LS-SEO-2026-01 and is not covered
   by the ₹59,000 bundled fee. Either raise a change order or fold it into a retainer
   month before starting — W9 is roughly a day, W10 is content-heavy and larger.

---

## 8. Out of scope

Per proposal §10 — replatforming, paid media spend and management, professional
photography, bulk content beyond retainer allowances, third-party tool fees, and any
guarantee of specific rankings.

**One flag on §10's assumption** that "the platform allows the technical changes
described": it does, but the client-rendering architecture (F1) means the technical SEO
work carries a real refactor (W1) rather than template edits. That is the largest single
line of effort in this plan and the proposal's Technical SEO Foundation line item
(₹12,000) was almost certainly scoped without it. Worth re-checking commercially before
Phase A starts.

---

## 9. Client SEO pack — reconciliation

The client supplied 20 markdown documents in `E:\Little_stepz\SEO\` (~5,300 lines), dated
July 2026. **They describe a different website from the one in this repo and the one on
production.** They cannot be used as a work order. This section records what was checked,
what is void, and what is worth keeping.

### 9.1 The mismatch

| | SEO pack claims | This repo / live production |
|---|---|---|
| Data layer | **Supabase** (7 docs) | Express 5 + Prisma 6 + Postgres |
| Product source of truth | static array in `lib/products.ts` (7 docs) | DB-backed via the backend API |
| Animation | **Framer Motion 12** (6 docs) | not a dependency |
| Repo shape | single Next.js app `littlstepz/` | Turborepo: `apps/web` + `apps/backend` + 6 packages |
| Fonts | Unbounded + Manrope | Anton, Manrope, Sora, Orbitron |
| Ordering model | "WhatsApp ordering, no cart needed" | full cart, Razorpay checkout, accounts, wishlist, affiliate, pre-orders |
| Auth | `supabase.auth.signInWithPassword()` | custom JWT + refresh tokens |
| Routes claimed | `/contact`, `/rc-cars`, `/diecast-models` | do not exist |
| Routes ignored | — | `/cart`, `/checkout`, `/wishlist`, `/account/*`, `/affiliate/*`, `/pre-order/*`, `/unboxing-policy`, `/cancellation`, `/warranty` |
| Categories | invents `rock-crawlers`, `drift-cars`, `diecast-models` | `blocks`, `die-cast-cars`, `hyper-go-cars`, `licensed-cars`, `rc-cars`, `stanley-bottles` |

Mentions of `Prisma`, `Razorpay`, `pnpm`, `Turborepo` and `monorepo` across all 20
documents: **zero**. Mentions of the real category slugs `hyper-go-cars`, `licensed-cars`,
`die-cast-cars`: **zero**.

### 9.2 The status claims are false

`LITTLE_STEPZ_TECHNICAL_SEO_REPORT.md` reports these as ✅ implemented and correct. Verified
against `https://littlestepz.in` on 21 Jul 2026:

| Claimed ✅ | Actual |
|---|---|
| `app/robots.ts` — "✅ Correct" | `/robots.txt` → **HTTP 404** |
| `app/sitemap.ts` — "✅ (incomplete)" | `/sitemap.xml` → **HTTP 404** |
| Organization + WebSite JSON-LD "injected globally" | **0** `application/ld+json` blocks in the homepage HTML |
| Product schema "✅ Correct" | none |
| BreadcrumbList "✅ Correct" | none |
| FAQPage on `/faq` "✅ Correct" | none |
| `generateMetadata` on product pages "✅ Correct" | **0** occurrences in the entire app |
| "Canonical tags ✅ all pages" | **0** canonical tags |
| `metadataBase`, title template, global OG/Twitter | absent — live `<title>` is `Little Stepz`, description `Toys store` |
| "Homepage H1 ❌ MISSING" | correct, but for a different reason: **0 `<h1>` in the raw HTML** because the page is client-rendered |

The live homepage serves 28KB of HTML containing zero H1, zero structured data, zero
canonical and zero Open Graph tags. The proposal's §3 external finding was right; the SEO
pack's audit was not.

### 9.3 Void — do not action

- `LITTLE_STEPZ_DEVELOPER_HANDOVER.md` — wrong stack, wrong file tree, wrong auth, wrong
  env vars, wrong deployment model. Every path in it is fictional relative to this repo.
- `LITTLE_STEPZ_TECHNICAL_SEO_REPORT.md` — every ✅ in §9.2 above.
- The ✅ status column in `LITTLE_STEPZ_AI_SEARCH_OPTIMIZATION.md` §6.
- File-path references in `LITTLE_STEPZ_SEO_HANDOVER.md` and
  `LITTLE_STEPZ_SEO_IMPLEMENTATION_CHECKLIST.md` (`lib/jsonld.ts`, `app/layout.tsx:28`, …).
- Its robots.ts snippet uses **retired crawler names** — `anthropic-ai` and `Claude-Web` are
  deprecated (current: `ClaudeBot`), and it omits `OAI-SearchBot`, `ChatGPT-User`,
  `Google-Extended` and `CCBot`. Use the W9 list instead.

### 9.4 Keep — genuine, stack-independent research

This is the part worth the money, and it survives intact because none of it depends on the
platform:

- **Keyword set** (`MARKETING_STRATEGY.md`) — primary: `RC cars India`, `buy diecast cars
  online India`, `licensed Ferrari RC car`, `Bugatti RC car 1:12`; plus building-blocks,
  anime-figure and collectibles terms. Feeds W5's title/meta mapping directly.
- **18 named competitor domains** across the two competitor analyses — real research, usable
  for gap analysis and link prospecting.
- **Product and category SEO copy templates** — reusable, but **remap them onto the six real
  category slugs** before use.
- **FAQ bank** — feeds both `FAQPage` schema (W4) and GEO citability (W10).
- **Comparison-content roadmap** ("1:12 vs 1:18 scale", "RC cars vs rock crawlers",
  "licensed vs generic") — strong GEO material; these are exactly the conversational queries
  AI engines answer and cite.
- **Conversational query → page mapping** in `AI_SEARCH_OPTIMIZATION.md` §8.
- **Positioning argument** — "premium collector destination, not a toy store". Needs a
  client decision (§7 item 6), but the reasoning is sound.

### 9.5 The gap the pack misses entirely

Across all 20 documents there is **no mention that AI crawlers do not execute JavaScript**.
The pack's AI-search strategy assumes its content is readable by GPTBot and PerplexityBot.
On the actual production site none of it is — those crawlers receive the same empty shell
Googlebot gets before rendering. Every GEO tactic in the pack is blocked behind W1.

### 9.6 Provenance

Worth raising with the client, diplomatically. The pack reads as though it was written
against a prototype or a template rather than against `littlestepz.in` — it reports
implementation details ("Passes `salePrice` to productSchema", "`onError` fallback handlers
on all product image `<Image>` components") that are specific enough to imply direct code
inspection, but of code that is not in this repo and not on production.

Two practical consequences:
1. If the client paid for that pack as an audit of their live site, they should know it does
   not describe their live site.
2. If a **second, separate Next.js build of littlestepz.in exists** somewhere — a redesign
   the pack was written against — then it must be produced before Phase A starts. The whole
   of §1 and W1–W11 assumes this repo is the deployment target. That assumption is currently
   verified against production, but it is worth asking the question out loud.

---

## 10. Root cause: the site never server-rendered at all

Found while implementing W2/W3, and it reframes the whole engagement.

### 10.1 The line

`apps/web/app/providers/auth-provider.tsx`, before the fix:

```tsx
export function AuthProvider({ children }) {
  const [loading, setLoading] = useState(true)   // starts true
  useEffect(() => { /* hydrate, then setLoading(false) */ }, [])
  if (loading) return null                        // ← server render returns nothing
  return children
}
```

Effects never run during server rendering, so `loading` was still `true` when the server
rendered. `AuthProvider` returned `null`. It wraps everything:

```tsx
<ThemeProvider><AuthProvider>
  <Navbar /><main>{children}</main><Footer />
</AuthProvider></ThemeProvider>
```

**Every route shipped an empty body.** Navbar, footer, page content, headings and every
nested JSON-LD block existed only inside the RSC flight payload (`self.__next_f.push(...)`),
which requires JavaScript to materialise.

### 10.2 Why it looked like an architecture problem

The symptoms matched "the site is client-rendered", so both the proposal's §3 audit and my
own §1 findings attributed it to the client-component architecture. The architecture is a
real and separate issue (F1), but it was not what produced the empty HTML. Client components
are normally server-rendered by Next.js; this one line opted the whole tree out.

Consequence ranking, corrected:

- **Googlebot** could recover the page on its second, JavaScript-rendering pass — delayed and
  crawl-budget-expensive, but not fatal.
- **AI crawlers** (GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot) do not execute JavaScript
  at all. They received an empty document on every URL. The site was wholly invisible to AI
  search, and no amount of GEO content work would have changed that.

### 10.3 Why the fix is safe

`AuthProvider` was doing guard work that the guards already do. `AuthGuard`, `GuestGuard`,
`AdminGuard`, `AffiliateGuard` and `Navbar` each independently gate on `isHydrated` from the
auth store, so protected routes stay protected without blanking the public site. The
provider now renders `children` unconditionally and only performs hydration in its effect.

One knock-on: restoring SSR meant `/products` actually executed during static prerender for
the first time, which surfaced an unrelated latent bug — `useSearchParams()` with no Suspense
boundary, which fails the build. Fixed by wrapping `children` in `<Suspense>` in
`app/products/layout.tsx`.

### 10.4 Measured before and after

Production build (`next build && next start`), raw HTML with no JavaScript executed:

| Route | H1 before | H1 after | JSON-LD before | JSON-LD after |
|---|---|---|---|---|
| `/faq` | 0 | 1 | 0 | 4 — Organization, WebSite, FAQPage, BreadcrumbList |
| `/about` | 0 | 1 | 0 | 2 |
| `/products/category/licensed-cars` | 0 | 0 ¹ | 0 | 4 — + CollectionPage, BreadcrumbList |
| `/products/[slug]` | 0 | 0 ¹ | 0 | 4 — + Product, BreadcrumbList |
| `/` | 0 | 0 ¹ | 0 | 2 |

¹ Still zero because these four fetch their catalogue data client-side and return a skeleton
from the server render (`app/products/page.tsx:117` — `if (loading) return <ProductGridSkeleton />`).
That is F1, and it is what remains of W1.

### 10.5 What this changes in the plan

- **W1 shrinks.** It is no longer "the site does not server-render". It is now specifically
  "four routes fetch their own data client-side and therefore have no body copy or H1 in the
  HTML". Metadata and structured data for those routes are already delivered (§10.6).
- **W3 and W4 are largely done, without W1.** A `layout.tsx` is a server component even when
  its `page.tsx` is `"use client"`, so it can export `generateMetadata` and emit JSON-LD.
  Per-product titles, descriptions, canonicals, OG tags and Product schema all ship today.
- **The §8 commercial flag stands, but for a smaller number.** The refactor is four routes,
  not a re-architecture.

### 10.6 One React 19 trap worth recording

JSON-LD rendered as a plain `<script>` from a nested route layout **does not reach the HTML**.
React 19 treats `<script>` as a hoistable resource and lifts it into `<head>`, which only
works while the document shell is open. A `<script>` produced by an async route segment
arrives after the shell has flushed, is dropped from the HTML, and survives only in the
flight payload — precisely the failure mode we are trying to fix, and invisible unless you
diff the raw HTML.

`components/seo/JsonLd.tsx` therefore emits the tag as raw markup inside a hidden wrapper,
which opts out of the hoisting path. Verified against a production build: without it, product
pages carry 2 JSON-LD blocks; with it, 4. Do not "simplify" that component back to a plain
`<script>` element without re-checking the served HTML.
