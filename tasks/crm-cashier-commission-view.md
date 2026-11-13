# CRM — Cashier's payments limited, cashier's own commission page, admin "To pay"

## Decisions (agreed 2026-11-13)
- **Payments:** a cashier sees only payments **recorded under their login** (list, detail, Collections). Outstanding and Advances show only **orders they created**. Transfers are hidden from cashiers. Cash Closing still shows the whole drawer. Customer credit stays visible (needed at the till). New permission `payments.view.all` (Admin).
- A cashier can take a payment, or apply credit, only on orders they can see (own + open counter pickups).
- **Login ↔ salesperson:** the admin links a salesperson to a CRM login in Settings → Salespeople (optional, one login per salesperson).
- **Till:** the Salesperson picker starts on the signed-in cashier's own salesperson. Otherwise it remembers the last pick, as before.
- **Cashier's page "My commission":** earned, taken back, net, paid and owed for the chosen dates, plus each sale's or return's commission and the cashier's rate. **No sale value or profit.** New permission `commission.view.own` (Cashier, Admin).
- **Admin:** the Commission page gets a "To pay" tab (people owed money, total due, a "Pay" button that prefills the owed amount) and a "Payouts" history tab.

## Tasks
### Data
- [x] `Salesperson.userId String? @unique` → User (migration). DATA_MODEL.md

### Schemas
- [x] Permissions `payments.view.all`, `commission.view.own`
- [x] Salesperson input `userId` (optional, nullable); SalespersonDto `user {id,name} | null`; option DTO `isMine`
- [x] `MyCommissionDto`; payout list DTO

### API
- [x] Payments: scope list/detail/collections by `createdById`; outstanding/advances by order `createdById`; transfers need `payments.transfer`; receive/apply-credit only on orders in sales scope
- [x] Salespeople: link a login (must be active, not linked elsewhere → 409); audit
- [x] `GET /commission/me` (commission.view.own), `GET /commission/payouts` (admin)
- [x] Vitest

### Web
- [x] Payments: hide Transfers tab and wording for cashiers
- [x] Settings → Salespeople: "CRM login" select
- [x] POS picker default to own salesperson
- [x] "My commission" page + nav
- [x] Commission page: "To pay" and "Payouts" tabs; Pay prefilled
- [x] USER_MANUAL.md

### Checks
- [x] migrate (local dev + test DB), crm-api tsc + Vitest, crm-web check-types + lint

## Review (2026-11-13)

**Built.** Migration `20261113060000_salesperson_login` (handwritten: Prisma won't create migrations without an interactive terminal) is applied to the local dev DB, and `prisma migrate diff` against the schema shows no difference.

**Checks**
- crm-api `tsc` and Vitest **228/228** (new `cashier-own.test.ts`: own payments list/detail, advances/outstanding, collections totals, transfers 403, no paying another cashier's order, login link 409 + unlink, till `isMine`, `/commission/me` shape has no value/profit, payout history admin-only, unlinked cashier).
- Two existing tests changed: the draft-payment rule test now records as admin (the cashier can't see an admin's draft any more), and the till options now include `isMine`.
- crm-web `check-types` and `lint` (0 warnings).
- Browser (headless Chromium, API on the **test** DB): 11/11 checks passed with no page errors. Admin: salespeople login column, To pay (₹70 owed), Pay prefills ₹70, Payouts list. Cashier: lands on POS, till preselects own salesperson, My Commission (₹100 earned, ₹30 paid, ₹70 owed, no profit), Payments without Transfers, nav without Dashboard/Reports. Phone width checked.
- Found in the browser and fixed: My Commission showed ₹0.00 while loading (now "—"), and order codes wrapped on phones.

**Notes**
- A cashier's commission list shows order codes without links: the salesperson can be on a sale another cashier rang up, which they can't open.
- The admin's "To pay" is derived from the existing summary (all-time owed), so no new figures to drift.
