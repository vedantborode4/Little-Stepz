# Little Stepz CRM: technical specification

For developers taking over or reviewing the CRM. Companion documents:

| Document | What it covers |
|---|---|
| [CONVENTIONS.md](CONVENTIONS.md) | Code layout and the rules every change follows |
| [DATA_MODEL.md](DATA_MODEL.md) | Every table and its rules, phase by phase |
| [RUNNING.md](RUNNING.md) | Local setup, seed, tests |
| [RUNBOOK.md](RUNBOOK.md) | Operating it on the VPS: deploy, backups, restore, incidents |
| [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) | What must be true before real data goes in |
| [WEBSITE_SYNC_CONTRACT.md](WEBSITE_SYNC_CONTRACT.md) | The website export endpoints the CRM reads (not yet built) |

## 1. What it is

A private back-office system for Little Stepz, separate from littlestepz.in. It covers:
- Products and variants, purchases with landed cost, and a stock ledger across Store and Godown.
- POS and delivery orders, split payments, pre-orders and advances, returns, and courier shipments.
- Cash closing, expenses and stock counts.
- Profit analytics and reports.
- Spreadsheet import, and a read-only pull from the website.

It runs on its own database. The only connection to the website is the read-only sync in section 8, and that is switched off until the website exposes its export endpoints.

## 2. Architecture

```
browser ──HTTPS──> nginx (crm.littlestepz.in)
                     ├── /api/*  → crm-api  127.0.0.1:8100  Express 5, TypeScript, CommonJS
                     └── /*      → crm-web  127.0.0.1:3100  Next.js 16 (App Router), React 19, Tailwind v4
crm-api ──Prisma──> crm-postgres 127.0.0.1:5433  Postgres 17 in Docker, own volume
```

| Workspace | Role |
|---|---|
| `apps/crm-api` | REST API at `/api/v1`. The only process that touches the database. |
| `apps/crm-web` | UI. Talks only to its own origin; `/api/*` reaches the API through nginx, or through Next's rewrite in development. |
| `packages/crm-db` | Prisma schema, migrations, and a generated client in its own output folder. It never shares `@prisma/client` with the website. |
| `packages/crm-schema` | Zod request schemas, enums with labels, the role→permission matrix, and response DTO types, shared by API and web. Every request is parsed through these. |

**Stack details:**
- Decimal maths uses `decimal.js` (ROUND_HALF_EVEN).
- The web app uses TanStack Query and Table, react-hook-form, recharts and sonner.
- Imports use exceljs and papaparse.
- Logs are pino, with a request id on every line.

**Request flow:** `routes → middleware (auth, permission, validation) → service → Prisma`.
- Controllers stay thin.
- Business rules live in services.
- Multi-step writes run in one `withTransaction` (retries on serialisation conflicts) and write their audit row in the same transaction.

## 3. Modules (`apps/crm-api/src/modules`)

| Module | Endpoints | Notes |
|---|---|---|
| auth, users | `/auth`, `/users` | Login, refresh, logout, password change; user admin |
| settings, audit | `/settings`, `/audit` | Business profile, locations, receiving accounts; audit explorer |
| catalog, products | `/categories`, `/brands`, `/products`, `/variants`, `/pricing`, `/website-mapping` | Option matrix, SKUs, price history, bulk price edit |
| suppliers, purchases | `/suppliers`, `/purchases` | Multi-currency shipments, landed-cost allocation, receiving, cost adjustments, purchase returns |
| inventory | `/inventory` | The **stock engine**: the single writer of stock movements, balances and average cost |
| customers | `/customers` | E.164 mobiles, duplicates and merge, masked contacts, customer prices |
| sales | `/sales`, `/pre-orders` | POS (idempotent) and orders, price resolution, GST back-out, reservations, fulfilment |
| payments | `/payments` | The **money ledger**: receipts, refunds, voids, customer credit, transfers, collections, outstanding, advances |
| returns | `/sales/:id/returns`, `/returns` | Returns by condition with exact revenue, GST and cost reversal |
| shipping | `/shipments`, `/couriers` | Packages and AWBs, status history that drives the order |
| cash, expenses | `/cash`, `/expenses` | Daily drawer close and lock; operating and order expenses |
| stockcounts | `/stock-counts` | Blind counts, approval into one adjustment, reversal |
| analytics, reports | `/analytics`, `/reports` | Profit waterfall and breakdowns, valuation, dashboard; 17 reports with CSV/XLSX |
| imports | `/imports` | Spreadsheet import with mapping, checking, approval and rollback |
| sync | `/sync` | Read-only website dry run and ID linking |

## 4. Accounting and inventory rules (enforced on the server)

1. **Stock is a ledger.**
   - `StockMovement` rows are append-only (DB triggers reject UPDATE and DELETE).
   - `StockBalance` is a cache updated in the same transaction, with a `quantity >= n` guard, so stock never goes negative.
   - Corrections are reversal documents.
2. **Buckets.** SELLABLE, DAMAGED, DEMO, QUARANTINE.
   - Physical = all buckets. Available = sellable − active reservations.
3. **Reservations.** Orders reserve at confirmation, and stock is deducted at dispatch or handover. POS sales deduct immediately.
4. **Costing.**
   - Moving weighted average landed cost per variant.
   - Each sale line freezes its unit cost at deduction.
   - Units with **unknown cost** are tracked separately and never valued or assigned a guessed cost.
5. **Landed cost.** (Foreign price × exchange rate) + allocated freight, duty and clearing.
   - Recoverable GST/IGST is excluded.
   - It is frozen at receipt. Late charges become cost adjustments.
6. **Sale lines snapshot** price, discounts, GST and cost, so later price changes never alter history.
7. **Payments.**
   - Payments are their own rows, allocated to orders up to the amount due. Excess becomes explicit customer credit.
   - An order's payment status is derived, never stored.
8. **Revenue counts at fulfilment.** Money on unfulfilled orders is an advance (a liability). Transfers, expenses and cash deposits are never sales.
9. **No hard deletes of financial or stock records.**
   - Master data is archived or deactivated.
   - The audit log is append-only and records before/after, user, IP and request id.
10. **Cash days lock.** Once a drawer's day is closed, every money writer refuses entries on it until an admin reopens it.

## 5. Security

| Area | Implementation |
|---|---|
| Passwords | bcrypt (12 rounds in production); users must change the temporary password on first sign-in |
| Sessions | JWT access token (15 min) in memory; opaque refresh token stored hashed (SHA-256), rotated on every use, revocable, sent as an `httpOnly`, `SameSite=Strict`, `Secure` cookie |
| Brute force | Sign-in limited to 20 failed attempts per IP per 15 min (in-memory, so one API process) |
| Roles | `ADMIN` (everything); `CASHIER` (POS, payments, customers, cash closing, operational reports; no costs or profit); `OPS` (receiving, stock moves and counts, shipping; no money). The matrix lives in `crm-schema/permissions.ts` and is checked on every route |
| Data shaping | Cost, margin and profit fields are removed server-side for roles without `costs.view`. Customer phone/email are masked in lists and reports; revealing them is a separate audited action |
| Integrity | Append-only triggers on ledgers, audit, imports and sync runs; `CHECK` constraints on money and quantities; enum parity between DB and schema checked at compile time |
| Network | API and web bind to 127.0.0.1; Postgres binds to 127.0.0.1:5433; nginx is the only public listener (TLS, HSTS, `noindex`) |
| Input | Every request body and query is parsed with Zod. SQL is parameterised (`$queryRaw` tagged templates only, no `Unsafe` variants). Uploads are capped at 5 MB / 5,000 rows |
| Output | Exports neutralise spreadsheet formula injection. React escapes all rendered text |
| Headers | helmet on the API; `X-Frame-Options: DENY`, `nosniff` and `same-origin` referrer on the web |

## 6. Conventions

- **Money:** `Decimal(14,2)`; unit costs and exchange rates `Decimal(18,6)`. Money crosses the wire as decimal strings.
- **Quantities** are integers.
- **Time:** timestamps are UTC. Business dates are IST (`todayIST`), stored as `DATE`.
- **Codes:** documents have gapless human codes from `Sequence` (`PRD-0001`, `CUS-00001`, `IMP-0001`, `SYN-0001`, …).
- **Errors:** `{ error: { code, message, details? } }` with stable codes (`STOCK_INSUFFICIENT`, `IMPORT_IN_USE`, …).

## 7. Import

`/imports` (admin, `import.manage`) brings in **products & variants**, **opening stock** and **customers** from CSV or XLSX.

1. **Upload.** The raw file body (≤ 5 MB, ≤ 5,000 rows) is parsed. Every non-empty row is kept as uploaded, with its line number.
2. **Map.** Target field → column. The mapping is suggested from saved templates, then from header names and aliases, and can be saved as a template.
3. **Check.** Each row is normalised (₹ and thousands separators, "18%", state names) and parsed with the **same Zod schemas as the forms**.
   - Products are grouped by name: rows sharing a name become one product with one variant per row.
   - Unknown categories, brands and SKUs are errors.
   - Records already in the CRM are **duplicates**, skipped and never overwritten.
   - A product with any bad row is held back whole.
4. **Approve.** One transaction. Rows are re-checked first; if anything changed since, nothing is imported and the rows are re-marked.
   - Opening stock posts one `OPENING` document owned by the batch (`sourceType = IMPORT`).
   - Blank costs stay **unknown**.
5. **Rollback.** Allowed only while nothing the batch created has been used since.
   - Products and variants are archived, and their SKUs renamed `SKU~IMP-0001` so a corrected file can reuse them. Price history is append-only, so they can't be deleted.
   - Opening stock is reversed through the stock engine.
   - Unused customers are removed. The audit log keeps what was created.

## 8. Website sync (read-only)

`WEBSITE_SYNC_MODE` selects the source:

| Mode | Source |
|---|---|
| `off` | Default in production. Sync requests are refused with `SYNC_OFF`. |
| `mock` | Built-in SAMPLE data shaped like the website. Refused in production. |
| `live` | The website's GET-only export endpoints, with a service key (`WEBSITE_SYNC_URL`, `WEBSITE_SYNC_KEY`). |

- **Dry run** compares website products and variants with the CRM by SKU. It reports links that can be made, conflicts, website-only items, and price/stock differences, plus counts of recent website orders. It writes only the `SyncRun` record.
- **Link IDs** (live only) applies the links from a dry run less than 24 h old, and only those that still match.
- Nothing is ever written to the website.
- Website order import is not built. It needs real data to design against, and the contract lists the extra fields it would need.

**State today:** no website data has been read or imported. The website code is unchanged, and the export endpoints are specified in [WEBSITE_SYNC_CONTRACT.md](WEBSITE_SYNC_CONTRACT.md) for separate review.

## 9. Tests

- Vitest in `apps/crm-api/test`: 19 files covering every module's rules and the owner's scenarios A–J.
- They run against a real Postgres test database (`littlestepz_crm_test`, migrated by the global setup) with no mocks of the database. Data is unique per run, so the suite can be re-run.
- Files run one at a time because they share the database.
- `pnpm --filter crm-api test`.

## 10. Deployment and operations

All artifacts are in `deploy/crm/`:

| File | Purpose |
|---|---|
| `ecosystem.config.cjs` | PM2: one `crm-api` and one `crm-web` process (fork mode) |
| `nginx/crm.littlestepz.in.conf` | TLS site; `/api/` straight to the API with `X-Forwarded-For` overwritten (API `TRUST_PROXY_HOPS=1`) |
| `env/*.env.production.sample` | Production env files for API and web |
| `deploy.sh` | Backup → pull → install → migrate → build → reload → health check |
| `backup.sh` | `pg_dump` (custom format), verified with `pg_restore --list`, SHA-256, copied off-server with rclone, 14 days kept locally |
| `restore.sh` | Restores into a scratch database by default; overwriting live needs `CONFIRM_LIVE_RESTORE=yes` |
| `restore-drill.sh` | Backup → restore → every table's row count compared → ledger and trigger spot checks |
| `table-counts.sh` | Exact row count of every table in a database (used by `restore.sh` and the drill) |
| `crontab.txt` | Nightly backup at 02:15; monthly restore drill |

- The database container is `docker/crm-postgres.compose.yml`, the same file locally and on the VPS.
- Health: `GET /health` checks the database.

## 11. Known limits and future work

- The login rate limit is per process. Keep one API process, or move the limiter to Redis before scaling out.
- XLSX import loads the workbook in memory (5 MB compressed cap). It is admin-only.
- GST rates and HSN codes in demo data are SAMPLE values; the CA must confirm the real ones.
- Not built, by decision:
  - Supplier payables, WhatsApp, barcodes, GST tax invoices (the billing software stays the source)
  - Live courier tracking
  - Website order import
  - Pushing stock to the website (needs explicit approval)
