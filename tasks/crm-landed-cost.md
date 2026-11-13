# CRM — set or change an item's landed cost after its stock is in

Stock uploaded without a landed cost (opening stock import, found stock with no average yet,
returns of such units) is held as **unknown cost**, and a known cost could never be corrected.
Admins can now set an item's landed cost at any time (decided 2026-11-13):

- **Any item**, including stock that came in on a purchase bill.
- **Stock on hand** (all buckets and locations) moves to the new cost per piece.
- **Sales that left with an unknown cost** get the new cost (and their returns follow).
- **Sales an earlier landed-cost entry costed** are re-costed, so a typo is fixed everywhere.
  Sales costed at dispatch from a known cost (purchase bill, opening stock with cost) never change.
- **Workbook-imported past sales** (`importBatchId` set, no stock moved) are left alone.
- Commission is worked out live from the sale records, so earned/owed follows; a lower profit
  can leave a salesperson overpaid (owed below zero).
- The stock ledger stays as it was posted (movements keep their original cost). Reversals of
  old unknown-cost entries already fall back to the current average, so nothing breaks.

## Design

- `LandedCostEntry` (append-only, code `LCE-00001`): variant, new cost, previous average, units on
  hand / of them unknown, stock value change, sold units filled / re-costed, net COGS change,
  reason, import batch, who, when.
- `LandedCostSaleLine` (one per sales line): units of that line whose cost came from an entry,
  at what cost, set by which entry — what a later entry re-costs.
- `setLandedCostInTx`: lock variant → revalue `VariantCost` (valuedQty = all on hand,
  totalValue = cost × units, unvaluedQty = 0) → fill unknown sales lines / re-cost tracked ones
  → recompute those lines' return lines with `returnLineAmounts` in return order → entry + audit.
  Refuses when nothing would change.
- Preview runs the same code in a transaction that is rolled back, plus commission owed
  before/after for the salespeople affected.
- Import kind `LANDED_COSTS` (SKU, landed cost per piece, optional reason); no rollback
  (setting a new cost is the correction).
- Permission `inventory.cost` (admin).

## Tasks

- [x] crm-db: models + `LANDED_COSTS` import kind + migration
- [x] crm-schema: permission, `setLandedCostSchema`, import kind/fields, DTOs
- [x] crm-api: `inventory/landed-cost-entries.ts` (set, preview, history), routes, stock card history
- [x] crm-api: `landed-costs.import.ts`
- [x] crm-web: "Set landed cost" modal with preview on the stock card, history list, import kind
- [x] Vitest: unknown stock → sale → return → set cost; re-cost; purchase-costed sales untouched;
      historical import untouched; commission follows; refusal when nothing changes; import
- [x] Typecheck crm-api + crm-web, full crm-api test run
- [ ] Browser check of the stock-card modal (not done: no browser in this session)

## Review

Built 2026-11-13, uncommitted (the cashier-access work is staged alongside it).

- Migrations: `20261113120000_landed_cost_entries` (tables + `LANDED_COSTS` import kind) and
  `20261113120100_landed_cost_recost_guard`. The second one was needed because triggers lock a
  sold line's cost once filled and make return lines append-only. It loosens that only for a
  transaction that has set `crm.landed_cost_entry` to an entry it just wrote, and only for the
  cost columns. It also makes `LandedCostEntry` append-only.
- API: `POST /inventory/variants/:id/landed-cost` and `/landed-cost/preview` (`inventory.cost`,
  admin only). The stock card returns `landedCosts` to roles with `costs.view`.
  `setLandedCostInTx` in `inventory/landed-cost-entries.ts` is the only writer; the import calls it per row.
- The ledger keeps its original movement costs. Write-offs and adjustments that took unknown-cost
  units stay "unknown" in the movements report. Profit, valuation and commission read
  `VariantCost` / sales lines / return lines, which are all updated.
- Tests: `test/set-landed-cost.test.ts` (6 scenarios); full crm-api suite 234/234 passing.
- Not applied to the dev DB (it holds the real-data import): run `npx prisma migrate deploy` in
  packages/crm-db when ready, then rebuild `@repo/crm-db` / `@repo/crm-schema`.
