# Website → CRM export contract

**Status: specification only.** The website (`apps/backend`) has **not** been changed. Nothing in this repository adds these endpoints, and the CRM has never read real website data. The CRM's sync runs against built-in SAMPLE data until these endpoints are built, reviewed, deployed and switched on (`WEBSITE_SYNC_MODE=live`).

This document is for whoever implements the endpoints on the website backend. The CRM side is already built and tested against this exact shape (`apps/crm-api/src/modules/sync/website-source.ts`).

## Principles

1. **Read-only.** Only `GET` endpoints. The CRM never creates, updates or deletes anything on the website, and these endpoints must not be able to either.
2. **Separate credential.** A dedicated service key, not a user or admin token. It grants these two endpoints and nothing else.
3. **Minimum data.** Products, variants, prices and stock; order numbers, statuses, totals and gateway payment ids. **No** customer names, phone numbers, emails or addresses.
4. **Two-way stock sync is out of scope.** Pushing CRM stock to the website is an optional future step that needs the owner's explicit approval and its own review.

## Authentication

| | |
|---|---|
| Header | `X-CRM-Service-Key: <key>` |
| Key | At least 32 random characters (`openssl rand -base64 48`). Stored on the website as an env var (e.g. `CRM_EXPORT_KEY`) and in the CRM as `WEBSITE_SYNC_KEY`. |
| Comparison | Constant time (`crypto.timingSafeEqual` on equal-length buffers). |
| Failure | `401` with no body detail. |
| Rate limit | e.g. 60 requests / 10 min per key. The CRM makes a handful of requests per dry run. |
| Transport | HTTPS only. Optionally restrict to the VPS's IP; both apps run on the same Hostinger VPS. |

Rotating the key means updating both env vars and restarting both processes. Old and new keys never need to work at the same time.

## Base URL

`WEBSITE_SYNC_URL` is the website API's versioned root, for example `https://api.littlestepz.in/api/v1`. The CRM appends the paths below.

## Pagination (both endpoints)

Cursor-based, so results stay stable while the website is in use.

```
GET …?cursor=<opaque>      (omit on the first page)
200 { "data": { "items": [ … ], "nextCursor": "<opaque>" | null } }
```

- Page size is up to the website (100–200 suggested).
- `nextCursor: null` ends the list.
- The CRM stops after 200 pages and treats more as an error.

## `GET /crm-export/products`

Every product that isn't deleted (`deletedAt IS NULL`), with all its live variants. A product without variants is returned with one entry describing itself.

```json
{
  "data": {
    "items": [
      {
        "id": "clx…",                 // website Product id
        "name": "YEGAO 1:64 Die-cast Car",
        "status": "ACTIVE",           // website's own status/visibility, informational
        "options": [{ "name": "Colour", "values": ["Red", "Blue"] }],
        "images": [
          { "url": "https://res.cloudinary.com/…/red.jpg", "variantId": "clx…", "position": 0 }  // variantId null = whole product
        ],
        "variants": [
          {
            "id": "clx…",             // website Variant id (or the product id for a product without variants)
            "sku": "YG64-RED",        // null when the website has no SKU; the CRM matches on SKU
            "name": "Red",
            "optionValues": ["Red"],  // one per product option, in option order
            "price": "499.00",        // regular price incl. GST, decimal string
            "salePrice": "449.00",    // null when not on sale
            "stock": 3                // website's current stock counter
          }
        ]
      }
    ],
    "nextCursor": null
  }
}
```

The CRM uses this to:
- **Propose links.** A website variant whose SKU matches an unlinked CRM variant is proposed for linking (CRM `Variant.websiteVariantId` and `Product.websiteProductId`).
- **Report conflicts.** Missing SKUs, duplicate SKUs, and ids already linked elsewhere are reported, never resolved automatically.
- **Show differences.** Price and stock differences on already-linked items are shown for information. The CRM never changes the website's prices or stock.

`options`, `optionValues` and `images` serve the next step, **creating missing products from the website**, and the CRM ignores them today. In that step:
- A website product with no CRM match becomes a CRM product.
- Its options and variants are copied, with their prices.
- Its photos are added to the CRM gallery **as links**: the files stay where the website keeps them and are never copied or deleted.
- Stock is **not** copied. CRM stock comes from an opening count or a stock count, so the stock ledger stays the record.
- Costs stay unknown until a purchase is entered.
- Like linking, it only happens after a dry run the admin has reviewed.

Website variants without a SKU can't be matched safely, so they need a SKU on the website first. Product name + option values are shown only as a suggestion.

## `GET /crm-export/orders?since=<ISO-8601>`

Orders created or updated since `since`. The CRM asks for the last 90 days.

```json
{
  "data": {
    "items": [
      {
        "id": "clx…",                    // website Order (or PreOrder) id
        "orderNumber": "LS-1042",        // what staff see; the CRM matches on this or the id
        "status": "DELIVERED",           // website status, informational
        "isPreOrder": false,
        "total": "948.00",               // order total incl. GST, decimal string
        "placedAt": "2026-10-20T10:15:00Z",
        "paymentRefs": ["pay_N8x…"]      // Razorpay payment ids (booking and balance for pre-orders)
      }
    ],
    "nextCursor": null
  }
}
```

**Today the CRM only counts these.** Its dry run reports how many website orders and pre-orders exist, how many are already linked to CRM orders (`SalesOrder.externalRef`), and how many payment references they carry. It does **not** import them.

Importing website orders into the CRM (as fulfilled sales with their gateway payments, linked rather than duplicated) is the next step once real data can be inspected. That step needs order lines too, so this endpoint would then add:

```json
"lines": [{ "sku": "YG64-RED", "quantity": 2, "unitPrice": "449.00" }]
```

Add the field now if convenient; the CRM ignores fields it doesn't know.

## What the CRM does with it

| Action | Who | Writes |
|---|---|---|
| Dry run (`POST /api/v1/sync/dry-run`) | Admin | Only a `SyncRun` record with the report. |
| Link IDs (`POST /api/v1/sync/link-ids`) | Admin, live source only, after a dry run less than 24 h old | Website ids on CRM variants and products, for the links in that dry run that still match cleanly. Recorded as a `SyncRun` and in the audit log. |

Every run is stored (append-only) with its full report, so "what did the website say on that day" can always be answered.

## Acceptance checks for the website endpoints

- [ ] Wrong, missing or old key → `401`; no data leaks in the error.
- [ ] `POST`/`PUT`/`PATCH`/`DELETE` on these paths → `404` or `405`.
- [ ] No customer PII in either response.
- [ ] Deleted products, variants and orders are excluded.
- [ ] Money is decimal strings with two decimals; timestamps are UTC ISO.
- [ ] Pagination returns every row exactly once while orders are being placed.
- [ ] Reviewed by the owner and deployed separately from any other website change.
- [ ] CRM switched to `WEBSITE_SYNC_MODE=live`, a dry run reviewed, and only then any IDs linked.
