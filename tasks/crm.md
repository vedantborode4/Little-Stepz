# Little Stepz CRM — build tracker

Plan: `C:\Users\borod\.claude\plans\i-am-trying-to-melodic-fountain.md` (decisions, data model, rules).
Branch: `crm` — one commit per phase, no AI attribution. The owner sets the pace between phases.
Conventions: `docs/crm/CONVENTIONS.md`.

## Phases

- [x] **1. Foundation** — workspaces, crm-postgres, auth + roles, audit (append-only), app shell + UI kit, settings (business, locations, accounts), users
- [ ] **2. Products & Variants** — categories, brands, products, variant matrix, SKUs, pricing (regular/offer/wholesale/tiers), GST/HSN, images, website ID mapping, bulk price edit
- [ ] **3. Inventory ledger** — movements + balances, opening stock, Store↔Godown transfers, buckets (damaged/demo), write-offs, low-stock alerts
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
