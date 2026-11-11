# CRM — Salesperson commission

Admin keeps a list of salespeople (staff ID + name + commission %). The cashier
optionally picks one at checkout (POS) or on the order form. The salesperson earns
their % of the sale's **goods value excluding GST** (line taxable values; shipping
never earns), counted on the day the sale is **handed over / dispatched**. Returns
take back the commission on the returned part, and cancelled orders never earn.
Admin records payouts, so the CRM shows earned, paid and still owed per salesperson.

## Decisions (agreed 2026-11-11)
- Salespeople are a separate staff list with no CRM login. They're identified by a **staff ID** that the admin types (unique, e.g. `S01`).
- The salesperson is optional. No salesperson means no commission.
- Every sale can carry one: POS and orders from any channel. Imported historical sales never earn.
- The rate is **frozen on the sale** when the salesperson is set. A later rate change applies only to new sales.
- Payouts are tracked. A payout is an **Expense** in a fixed "Staff commission" category, linked to the salesperson. It leaves an account, counts in cash closing and can be voided the usual way.

## Rules (how the numbers work)
- Sale commission = rate × Σ line taxable value, rounded to paise.
- Return clawback = rate × the returned lines' taxable value, dated on the return's business date. It's worked out on cumulative returned value, so a fully returned sale nets to exactly ₹0.
- Earned in a period = commission on sales fulfilled in the period − clawbacks on returns dated in the period.
- Owed = all-time earned − all-time paid (voided payouts excluded). A negative figure is shown as "paid in advance".
- Admin can change or clear the salesperson on any sale later. The sale then takes the new person's current rate. This is recorded in the order timeline and the audit log.
- Commission is calculated from data that's already frozen (lines, returns), not stored per sale, so it can't drift.

## Tasks
### Data (packages/crm-db)
- [x] `Salesperson` model: id, staffCode (unique, case-insensitive key), name, commissionRate Decimal(5,2) 0–100, isActive, timestamps
- [x] `SalesOrder.salespersonId?` + `SalesOrder.commissionRate?` (DB check: both set or both null)
- [x] `Expense.salespersonId?` (payouts). A void copies it to the reversal row.
- [x] Migration also seeds the "Staff commission" expense category
- [x] Update docs/crm/DATA_MODEL.md

### Schemas + permissions (packages/crm-schema)
- [x] Salesperson input/DTOs; optional `salespersonId` on POS sale + order input
- [x] Commission summary/detail DTOs; payout input
- [x] New permission `commission.manage` (ADMIN only). Cashiers see only active salespeople's names and IDs, never rates or earnings.

### API (apps/crm-api)
- [x] `salespeople` module: list (picker: active, no rates) / admin list + create + update (rate, name, active) with audit
- [x] Sales: accept `salespersonId` on POS sale, create order and edit draft; freeze the rate; reject inactive salespeople
- [x] Sales: admin `PATCH /sales/:id/salesperson` (change/clear) → event + audit
- [x] `commission` module: summary per salesperson for a date range (sales count, commissionable value, earned, clawback, net, paid, owed), and detail (each sale + return line)
- [x] Payout: `POST /commission/payouts` creates the expense through the existing expense path (cash-day lock, audit)
- [x] Reports registry: "Salesperson commission" CSV export
- [x] Vitest scenarios: sale earns; rate frozen across a rate change; partial + full return nets exactly; cancelled order earns nothing; reassign; payout + void affect "owed"; cashier is forbidden from rates/summary

### Web (apps/crm-web)
- [x] Settings → Salespeople: list, add, edit rate and name, deactivate
- [x] POS: optional "Salesperson" picker. It stays on the last pick for that till until changed, so the cashier doesn't re-pick every sale.
- [x] Order form (new/edit draft): salesperson picker
- [x] Order detail: shows salesperson + rate. Admin can change or clear it.
- [x] Commission page (admin): date range, table per salesperson, drill-down, "Record payout" dialog
- [x] USER_MANUAL.md section

### Checks
- [x] `prisma migrate dev` on local DB, crm-api tests, typecheck/lint crm-web + crm-api
- [~] Drive it in the browser: POS sale with salesperson → commission page → return → payout → cash closing (partly: see review)

## Not included (ask if wanted)
- Salespeople logging in to see their own commission
- Different rates per category or product
- Commission on shipping or on GST
- Splitting one sale between two salespeople

## Review (2026-11-11)

**Built.** Everything above, on `main`, not committed. Migration `20261111060000_salesperson_commission` is applied to the local dev DB and the test DB.

**Checks**
- crm-api `tsc`, crm-web `check-types` + `lint` (0 warnings): clean.
- Vitest: full suite 214 tests. 213 passed on the first run; the one failure was a bug in the new test (refund payload built before the cash account existed). After fixing it, `commission.test.ts` passes 7/7. The suite wasn't rerun in full after that fix: only the test file changed.
- Browser (headless Chromium against the **test** DB, never the dev DB):
  - Sign-in, Settings → Salespeople (add; staff ID saved in capitals) and the POS salesperson picker all render and work.
  - Docker Desktop then stopped ("unable to start"), so the browser run of checkout → order page → Commission page → payout didn't finish. That path is covered by the API scenario tests, not yet by clicking through.

**Design notes**
- Commission isn't stored: it's worked out from the frozen sale lines and return lines on every read, so it can't drift. The rate is the only thing frozen per sale.
- Return clawback uses the running returned total, so partial returns never leave a paisa behind.
- A payout is an `Expense` with `salespersonId` in "Staff commission". Manual expenses can't use that category, and the expense form hides it.

**Follow-ups**
- Finish the click-through once Docker runs: checkout → order page "Change" → Commission page → Record payout → Cash Closing shows the payout.
- Production: `deploy/crm/deploy.sh main` runs `migrate deploy`, which applies the migration.
