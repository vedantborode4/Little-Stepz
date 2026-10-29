# Little Stepz CRM — build tracker

Plan: `C:\Users\borod\.claude\plans\i-am-trying-to-melodic-fountain.md` (decisions, data model, rules).
Branch: `crm` — one commit per phase, no AI attribution. The owner sets the pace between phases.
Conventions: `docs/crm/CONVENTIONS.md`.

## Phases

- [x] **1. Foundation** — workspaces, crm-postgres, auth + roles, audit (append-only), app shell + UI kit, settings (business, locations, accounts), users
- [x] **2. Products & Variants** — categories, brands, products, variant matrix, SKUs, pricing (regular/offer/wholesale/tiers), GST/HSN, images, website ID mapping, bulk price edit
- [x] **3. Inventory ledger** — movements + balances, opening stock, Store↔Godown transfers, buckets (damaged/demo), write-offs, low-stock alerts
- [ ] **4. Purchases & landed cost** — suppliers, shipments, FX, charges, allocation, input-GST split, receiving, weighted average, cost adjustments, purchase returns (Scenario A)
- [ ] **5. Customers** — profiles, phone lookup, dedupe + merge, wholesale terms, customer prices, PII masking
- [ ] **6. Sales / POS** — POS + order form, price resolution, discounts, GST back-out, reserve→deduct flow, COGS snapshot, receipts (Scenarios B, F)
- [ ] **7. Payments & collections** — split tender, installments, allocation limits, customer credit, collections dashboard, ageing, transfers (Scenarios C, D)
- [ ] **8. Pre-orders & advances** — advances liability, allocation on receipt, balance, fulfilment (Scenario E)
- [ ] **9. Returns & refunds** — returns by condition, refunds/credit, revenue + COGS reversal (Scenario J)
- [ ] **10. Courier & shipping** — shipments, packages/AWBs, status history, courier cost vs charge (Scenario G)
- [ ] **11. Cash closing & expenses** — expenses, daily cash session, deposits, discrepancy, lock
- [ ] **12. Stock reconciliation** — count sessions, blind count, approval, adjustments, reversal (Scenario H)
- [ ] **13. Profit, valuation, dashboard & reports** — profit waterfall, projections, dashboard, 17 reports (Scenario I)
- [ ] **14. Import, website sync & go-live** — import wizard + rollback, read-only website pull, VPS deploy, backups, restore drill, tech spec

## Phase 1 — Foundation

- [x] `docker/crm-postgres.compose.yml` (Postgres 17, 127.0.0.1:5433)
- [x] `packages/crm-schema` — env-free Zod contracts, enums, permission matrix
- [x] `packages/crm-db` — Prisma schema (own generated client), User/RefreshToken/AuditLog/BusinessProfile/Location/ReceivingAccount, append-only audit trigger
- [x] `apps/crm-api` — core (errors, validate, permissions, tx, audit, list query, export, env), modules auth/users/settings/audit, seed
- [x] `apps/crm-api` tests — auth, role gates, audit immutability, settings rules
- [x] `apps/crm-web` — tokens + fonts from the admin, shell (sidebar, top bar, bottom nav), UI kit, login, change password, settings pages, users, audit explorer
- [x] `docs/crm/` — CONVENTIONS.md, DATA_MODEL.md, RUNNING.md
- [x] Verify: builds, lint, typecheck, tests, browser walkthrough per role

### Phase 1 review
- 23 API tests pass: auth (lockout, rotation, reuse detection, forced password change, instant deactivation), role gates, last-admin and last-location guards, audit before/after, append-only trigger (UPDATE/DELETE/TRUNCATE rejected), no secrets in audit, CSV formula neutralisation.
- Browser walkthrough (headless Chrome): login, dashboard, all settings tabs, add-user modal, audit explorer, upcoming-module page, mobile (390px) and dark theme; cashier sees no admin modules and gets "no access" on Settings/Audit. No console errors or 5xx.
- Decision: `prisma migrate reset` is blocked for AI agents, so the test DB is migrated (`migrate deploy`) and tests never assume an empty DB.

## Phase 2 — Products & Variants

- [x] Catalog schema: Sequence, Category, Brand, Supplier, Product, options/values, Variant, PriceTier, PriceChange (append-only) + DB price CHECKs
- [x] API: categories/brands, suppliers, products (list/detail/create/update), variants (add/edit/archive), quantity tiers, price history, bulk price preview/apply, website mapping
- [x] Web: product list (filters, sort, export), create with option matrix + fill-all + SKU suggestions, duplicate, edit, detail with variant/tier/history modals, categories & brands, bulk price editor, variant mapping screen
- [x] Seeds: 7 owner categories in base seed; SAMPLE catalog (YEGAO 1:64 ×4 colours, MJX RC, Hot Wheels, Stanley ×3) in `seed:demo`
- [x] Tests: 13 catalog tests (36 total, all re-runnable)

### Phase 2 review
- Exit criteria met: YEGAO 1:64 has 4 colour variants with their own SKUs; the bulk edit previews old→new per variant and applies only on confirmation, refusing stale previews.
- Browser: created a 2-colour product through the matrix form, product list and detail, categories, bulk preview, mapping screen, mobile list. No console errors.
- Found while verifying: an "All brands" filter sent `""` and silently failed UUID validation, which is now fixed in the contracts. The product detail table was cramped at 1366px; the details card now stacks below it until 2xl.
- Deferred, with reason: image **upload** (URL field for now) until storage on the VPS is decided; customer-specific prices move to phase 5 (needs customers).
- Added `.prettierrc.json` per CRM package (the root has none) and formatted all CRM files.

## Phase 3 — Inventory ledger

- [x] Schema: StockDocument + StockMovement (append-only), StockBalance (CHECK ≥ 0), VariantCost; buckets SELLABLE/DAMAGED/DEMO/QUARANTINE
- [x] Engine: single writer, sorted row locks per variant, guarded decrements, weighted average with unknown-cost units kept apart, reversal at original cost
- [x] Operations: opening stock (once per item; cost optional), Store↔Godown transfers, status changes, write-offs, adjustments, reversals; new `inventory.adjust` permission (admin)
- [x] Queries: stock levels (SQL, filters/sort/state, CSV/XLSX), summary, ledger, document detail, variant stock card with reconciliation; costs stripped for roles without `costs.view`
- [x] Guards: can't archive a variant/product or deactivate a location that holds stock
- [x] Web: stock levels (per-location columns, low/out filters, cost value), movements ledger, record-movement form with item search (+ "all variants of product"), stock card, document modal with reversal; stock shown on products list/detail; dashboard KPIs
- [x] Demo: SAMPLE opening stock (YEGAO 5/8/4/3 = 20, Hot Wheels 24 with unknown cost, Stanley 12 at Godown)
- [x] Tests: 21 new (57 total) — cost maths, 20-unit parent total, damaged not double counted, transfers, atomic failure, concurrent removals never negative, unknown cost handling, reversals, guards, role visibility, ledger invariants

### Phase 3 review
- Exit criteria met: 5/8/4/3 gives a parent total of 20. Moving 2 to damaged keeps physical stock at 8 and lowers sellable to 6. Negative stock is blocked, including under 5 parallel requests.
- Found in the browser: the stock list's default sort referred to table aliases from inside a CTE, which caused a 500. It's now fixed and covered by a test for every sort. Internal moves showed "Unknown" cost, which was misleading, so they now show "—"; "Unknown" is reserved for genuinely missing costs.
- Costing note: costs follow posting order. Backdating changes report dates, not costs already recorded.
