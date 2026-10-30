# Little Stepz CRM — build tracker

Plan: `C:\Users\borod\.claude\plans\i-am-trying-to-melodic-fountain.md` (decisions, data model, rules).
Branch: `crm` — one commit per phase, no AI attribution. The owner sets the pace between phases.
Conventions: `docs/crm/CONVENTIONS.md`.

## Phases

- [x] **1. Foundation** — workspaces, crm-postgres, auth + roles, audit (append-only), app shell + UI kit, settings (business, locations, accounts), users
- [x] **2. Products & Variants** — categories, brands, products, variant matrix, SKUs, pricing (regular/offer/wholesale/tiers), GST/HSN, images, website ID mapping, bulk price edit
- [x] **3. Inventory ledger** — movements + balances, opening stock, Store↔Godown transfers, buckets (damaged/demo), write-offs, low-stock alerts
- [x] **4. Purchases & landed cost** — suppliers, shipments, FX, charges, allocation, input-GST split, receiving, weighted average, cost adjustments, purchase returns (Scenario A)
- [x] **5. Customers** — profiles, phone lookup, dedupe + merge, wholesale terms, customer prices, PII masking
- [x] **6. Sales / POS** — POS + order form, price resolution, discounts, GST back-out, reserve→deduct flow, COGS snapshot, receipts (Scenarios B, F)
- [x] **7. Payments & collections** — split tender, installments, allocation limits, customer credit, collections dashboard, ageing, transfers (Scenarios C, D)
- [x] **8. Pre-orders & advances** — advances liability, allocation on receipt, balance, fulfilment (Scenario E)
- [x] **9. Returns & refunds** — returns by condition, refunds/credit, revenue + COGS reversal (Scenario J)
- [x] **10. Courier & shipping** — shipments, packages/AWBs, status history, courier cost vs charge (Scenario G)
- [x] **11. Cash closing & expenses** — expenses, daily cash session, deposits, discrepancy, lock
- [x] **12. Stock reconciliation** — count sessions, blind count, approval, adjustments, reversal (Scenario H)
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

## Phase 4 — Purchases & landed cost

- [x] Schema: PurchaseShipment, PurchaseLine, ShipmentCharge, CostAdjustment(+lines), PurchaseReturn(+lines); triggers lock received purchases (header, lines, charges) and make adjustments/returns append-only
- [x] Landed-cost engine (pure, unit-tested): FX per purchase, allocation by value/quantity/weight/volume with exact remainder, recoverable GST/IGST → input tax credit
- [x] API: drafts (create/edit/cancel), live preview, last-used rate suggestion, receive (row-locked, posts PURCHASE stock doc at landed cost), late charges (on-hand share revalues stock, sold share → cost of sales), returns to supplier; costs stripped for Ops
- [x] Web: purchases list, purchase form with live server preview per line, detail with landed-cost breakdown, receive/cancel/late-charge/return dialogs, suppliers screen
- [x] Demo: Scenario A seeded as SAMPLE (PUR-0001: 10 × MJX at ₹12,500 landed, ₹22,860 IGST as credit)
- [x] Tests: 16 new (73 total) — Scenario A figures and stock/value effect, receive-once under a race, weighted average across batches, DB locks, draft edit/cancel, validation, FX charges, late charges, recoverable tax, returns, Ops/cashier access

### Phase 4 review
- Exit criteria met (**Scenario A**): 10 MJX at ¥900 × 12 + ₹17,000 charges = ₹12,500 landed each. Stock +10, inventory value +₹1,25,000, IGST kept out of cost.
- Browser: Scenario A detail, a new INR purchase built in the form (live preview ₹5,760), saved, received through the confirm dialog, suppliers screen, mobile list. No console errors.
- Found while verifying: the demo seed and export filenames used the UTC date (a day behind IST before 05:30). Both now use `todayIST()`, and this is recorded in lessons.md.
- Not in scope (decided in planning): supplier payables. Returns record goods only, not supplier credit.

## Phase 5 — Customers

- [x] Schema: Customer (code, E.164 mobile unique, WhatsApp, email, address, type, credit terms, merge pointer), CustomerPrice; trigram index for similar names
- [x] Contracts: shared mobile normaliser (Indian 10-digit, 0/91 prefixes, international +), customer/price/merge schemas, DTOs
- [x] API: list (masked contacts, phone lookup), detail, create/edit with duplicate-mobile block, duplicate check + duplicate pairs, contact reveal (audited), merge (audited), customer-specific prices, export (masked unless admin)
- [x] Web: customer list, profile, form with live duplicate warnings, contact reveal, prices, merge, duplicates screen, reusable customer picker
- [x] Demo: SAMPLE retail and wholesale customers
- [x] Tests: normaliser, duplicate block, masking per role, reveal audited, merge moves prices and is audited, price permissions

### Phase 5 review
- Exit criteria met: a duplicate phone is blocked however it is written. Merging is audited on both customers. The cashier sees masked contacts in the list and on profiles, and every reveal is logged with the user.
- Browser: list (masked), new-customer form showing the "may be an existing customer" warning and then the mobile block, saved profile, audited reveal, customer price added through the item search, wholesale terms, merge dialog, duplicates screen, mobile list; cashier list masked, duplicates screen refused. No console errors.
- Found while verifying: the demo seed called the service directly, so its mobiles skipped normalisation (`9000000101` instead of `+919000000101`) and the duplicate block couldn't see them. The seed now parses through the shared schema. A new DB `CHECK` refuses any non-E.164 phone, so this can't happen silently again. The dev rows were repaired, and the duplicate the UI had created was merged through the real merge service.
- Permissions added: `customers.merge` and `customers.export` (admin only). Customer prices need `products.manage`, since pricing is an admin decision even though cashiers manage customers.

## Phase 6 — Sales / POS

- [x] Schema: SalesOrder (FY codes, frozen amounts after draft), SalesOrderLine (price snapshot + COGS fixed once), Reservation (release-only), SalesOrderEvent (append-only); triggers and CHECKs
- [x] Pure engines (unit-tested): price resolution (customer > tier > wholesale > offer > regular), totals with order-discount split and GST back-out, financial-year codes
- [x] Inventory: reservations module (reserve under the variant lock, release once), engine guard so nothing takes reserved stock, available = sellable − reserved in stock lists and product totals
- [x] API: sellable item search, live quote, idempotent POS sale, orders (draft/edit/confirm), pack, hand over / dispatch (deducts, fixes COGS), deliver, cancel (releases), list/export, detail with profit (admin), revenue summary; customer stats; merge moves orders
- [x] Web: POS (search + Enter, quantity stepper, discounts, admin price override, live server totals, checkout, completion screen), order form, orders list, order detail with actions/timeline/profit, printable receipt (80 mm thermal or A4, "not a tax invoice"), customer order history and stats, dashboard sales KPIs
- [x] Tests: 21 new (109 total) — Scenarios B and F, idempotent POS under concurrency, reservation lifecycle and guards, last-unit race, pricing through the API, frozen records, revenue timing, unknown costs, role rules, merge

### Phase 6 review
- Exit criteria met. **Scenario B:** ₹18,000 sale of an item costing ₹12,500 shows net sales ₹15,254.24, GST ₹2,745.76, gross profit ₹2,754.24 (18.1%) and ₹5,500 before GST, side by side and labelled. **Scenario F:** selling 2 Blue YEGAO leaves 5/6/4/3, so only Blue drops. **No double deduction:** the same checkout key submitted three times, two of them concurrently, gives one sale and one stock document.
- Browser: POS cart and checkout, receipt, Scenario B sale with profit card, delivery order (confirm → reserved → packed → dispatched), dashboard, mobile POS. Cashier POS sale with no cost or profit shown. Ops refused at the POS but can see orders. No console errors.
- Found while verifying: the line discount and price inputs stretched to full width because the shared input's `w-full` beat the width class (now wrapped). CGST/SGST were each half the GST rounded, which can be a paisa off on odd totals; they're now split in paise.
- Decisions: receipts are a print-styled page (80 mm or A4) rather than a PDF, so any browser-connected thermal printer works. The shell hides itself when printing. Cancelling an order needs `sales.manage` (admin), in line with "non-admin corrections need approval". Payments on a sale arrive in phase 7. Until then the POS completes the sale without recording tender.

## Phase 7 — Payments & collections

- [x] Schema: Payment (IN/OUT, account, fee, reference, reversal), PaymentAllocation (from a payment or customer credit, signed), CustomerCreditEntry, AccountTransfer — all append-only
- [x] Engine: allocations never exceed what's due (order row locked), excess only as explicit customer credit, credit spend locked per customer, voids as reversing rows, derived payment status
- [x] POS split tender (walk-ins pay in full), payments on orders (installments), apply credit, refund credit, cancel-with-payment settlement (refund or credit)
- [x] Collections (by method, account, business/personal, channel; fees and net), outstanding with ageing 0–30/31–60/60+, account transfers kept out of sales
- [x] Web: POS tender, order payments card, payments list, collections, outstanding, transfers, customer balance and credit
- [x] Tests: Scenarios C and D, allocation limits under concurrency, credit, voids, refunds, cancel settlement, transfers not revenue, collections figures, roles

### Phase 7 review
- Exit criteria met. **Scenario C:** a ₹5,500 walk-in sale paid ₹500 cash + ₹5,000 PhonePe is one sale with two payments, Paid, and each amount shows under its account in collections. **Scenario D:** a ₹10,000 sale with ₹5,000 paid shows Partially paid with ₹5,000 outstanding (aged 0–30, receivable). The second instalment makes it Paid and clears it from outstanding.
- Invariants tested:
  - Two concurrent full payments on one order leave exactly one applied.
  - Leftover money is refused unless kept as credit.
  - Credit can't go negative.
  - A void whose credit was already spent is refused.
  - Paid money on a cancelled order must be refunded or credited.
  - Transfers change account movement but never received money or sales.
  - Payments can't be edited or deleted at the DB, except the customer re-link on merge.
- Browser: POS split tender (cash + PhonePe with reference), paid sale's payments card, an instalment on an open delivery order (Partially paid), outstanding with ageing, a cash-to-bank transfer, collections by account/method/channel, customer outstanding and credit, mobile collections. Cashier sees no transfer or void actions. No console errors.
- Found while verifying:
  - The collections date inputs stretched full width (same `w-full` issue; wrapped).
  - The account table hid its last column at 1366 px (now full width).
  - The order page showed payments below the timeline (payments now sit under the items).
  - The two walk-in POS sales recorded during phase 6 verification predate tender entry, so they showed as unpaid. They were settled through the payments API with a note saying so.
- Permission added: `payments.transfer` (admin). Voids and credit refunds use `payments.refund` (admin). Cashiers record payments and apply credit.

## Phase 8 — Pre-orders & advances

- [x] Reservation history per order line (release and re-allocate), one active reservation per line enforced by trigger
- [x] API: allocate (all or nothing), release (admin), expected-arrival changes, pre-order board with oldest-first queue (awaiting / ready / allocated, queue position, late flag), waiting-by-item, allocate all ready, advances list and summary
- [x] Web: pre-orders board (summary, waiting by item, bulk and per-item allocation, filters), new pre-order form (expected arrival, no "out of stock" alarm), pre-order bar on the order page (allocate, release, change date, advance and balance), advances report, dashboard "Advances held", receipt shows payments and becomes an order confirmation before handover
- [x] Demo: SAMPLE Scenario E pre-order with a ₹4,000 website advance
- [x] Tests: 8 new (133 total) — Scenario E end to end through a real purchase receipt, oldest-first allocation, insufficient stock, release and re-allocate with reservation history, regular orders unaffected, late flag and rescheduling, cancel with advance to credit, advances report, ops permissions

### Phase 8 review
- Exit criteria met (**Scenario E**). A ₹20,000 pre-order takes a ₹4,000 website advance (₹80 gateway fee). Stock, revenue and reservations stay untouched; only advances rise by ₹4,000. Handover is refused before allocation. The purchase arrives (+1 physical), and allocation reserves it, so physical is still 1 and available is 0. The ₹16,000 PhonePe balance makes it Paid, still with no revenue. Handover takes stock to 0, fixes cost at ₹12,500, adds ₹20,000 revenue once, and clears the advance.
- Browser: board showing the seeded pre-order "Stock available" with the item waiting, "Allocate all ready", balance payment, handover, receipt listing both payments, a new pre-order waiting for stock with Allocate / Change date, advances report, mobile board. No console errors.
- Found while verifying:
  - A reservation could only ever exist once per line, so a released pre-order could never be allocated again (now a history with a trigger guard).
  - The item search shouted "Out of stock" in red while taking pre-orders (now neutral).
  - The receipt didn't list payments, which a pre-order customer needs as proof of their advance (added, and titled "Order confirmation" until handover).
  - A React key warning on the new receipt rows.
- Website pre-orders are imported read-only in phase 14 and land in this same flow.

## Phase 9 — Returns & refunds

- [x] Schema: SalesReturn (+lines) append-only, with condition per line, revenue/GST/cost reversed, refund method and links to the refund payment, credit entry and stock document; RETURN credit type
- [x] Engine (pure, unit-tested): proportional line amounts with exact remainders, cost of returned units (known first), required refund = paid − new net value
- [x] Rules: only fulfilled orders, never more than sold − already returned, resellable → sellable stock at original cost, damaged → damaged bucket, write-off → no stock (cost stays as a loss); money back as refund or credit only when paid exceeds the new value
- [x] Order net value (total − returns) drives due, payment status, outstanding, allocation limits, lifetime value, profit and the sales summary
- [x] Exchanges: customer credit usable as tender at the POS
- [x] Web: return dialog with live preview on the order page, returns list, returns on order/receipt, POS "use credit"
- [x] Tests: Scenario J, partial and repeated returns, over-return refused, unpaid order returns reduce due, write-off keeps cost, summary nets returns, credit exchange at POS, roles

### Phase 9 review
- Exit criteria met (**Scenario J**): a paid ₹1,770 sale of two items is returned, one resellable and one damaged, with a cash refund.
  - The resellable item goes back to sellable stock and the damaged one to the damaged bucket; physical stock is unchanged.
  - A ₹1,770 refund payment goes out of the cash account, and the order shows Refunded with net value 0.
  - Today's net sales drop by ₹1,500 (excl. GST), returns show ₹1,770, and cost of goods drops by ₹1,000 because both units came back at the cost they left at.
- Also tested:
  - A line returned in two goes reverses exactly what it sold for, and returning a third time is refused.
  - An unpaid credit sale just owes less.
  - A part-paid order gives back only the overpaid difference, as credit.
  - A write-off keeps its cost as a loss.
  - An unfulfilled order is refused, and the shipping refund is capped.
  - An exchange is paid from credit at the POS.
  - Cashiers can see returns but not record them.
- Browser: POS sale, return with live preview (credit pre-selected for a known customer), order showing "1 returned", a −₹449 credit allocation and the returns card, exchange checkout using the credit ("Fully paid"), returns list and return detail. No console errors.
- Found while verifying: my browser driver couldn't type into text areas (it was a test-tool fix, not an app bug). The return row in the order's returns card used the bold button font.
- Decisions: recording a return is admin-only (`sales.manage`, a correction), and cash refunds need `payments.refund`. No separate credit-note document: the receipt shows items returned and the net value.

## Phase 10 — Courier & shipping

- [x] Schema: CourierPartner (tracking link template), Shipment (one open per order, courier cost), ShipmentPackage (one AWB each, unique per courier), ShipmentEvent (append-only status history)
- [x] Rules: shipment status drives the order (packed packs it; dispatched deducts stock through the sales engine and needs a courier and an AWB; delivered delivers it), RTO and back-with-us recorded, cancel before dispatch; status is entered by hand (no live tracking claimed)
- [x] API: couriers (settings), shipments for delivery orders, packages, status changes, list and board counts, courier cost vs shipping charged
- [x] Web: shipping board (status tabs, counts, cost vs charged), shipment card on delivery orders (create, AWBs with tracking links, status steps, history), couriers in settings
- [x] Tests: Scenario G, dispatch guards, AWB uniqueness, status order, RTO, cancel, roles

### Phase 10 review
- Exit criteria met (**Scenario G**):
  - A new customer is added from the order form, and a delivery order is confirmed.
  - A Delhivery shipment is created with an AWB (which gets a working tracking link) and a ₹62 courier charge.
  - Packing packs the order. Dispatch takes the item out of stock. Delivered marks the order delivered.
  - The history shows each step with the user.
- Also tested:
  - Dispatch needs a courier and an AWB.
  - Statuses can't go backwards.
  - AWBs are unique.
  - There's one open shipment per order, and a new one is allowed after cancelling.
  - Parcels lock after dispatch (also at the DB).
  - RTO → back with us → return to stock.
  - An order dispatched by hand can still get a shipment.
  - Counter orders can't ship.
  - Cashiers can't ship; ops can't edit couriers.
  - A tracking link must contain `{awb}`.
- Browser: couriers settings, new customer created from the order form, delivery order, shipment created with courier, AWB and cost, packed → dispatched → delivered from the shipment card, shipping board with tabs and cost vs charged. No console errors.
- Found while verifying: "Need a shipment" counted an order that had already been dispatched by hand. It now counts confirmed and packed delivery orders only.

## Phase 11 — Cash closing & expenses

- [x] Schema: ExpenseCategory, Expense (append-only, voided by a reversal, operating or for an order, paid from an account), CashSession (one per cash account per day)
- [x] Rules: expected cash = opening + received − refunded − cash expenses + transfers in − transfers out; counted − expected = discrepancy (recorded, never posted to sales); closing locks the day so no payment, refund, expense or transfer can be posted to that drawer on that date; admin reopen with a reason; opening defaults to the last count
- [x] API: expense categories, expenses (create, void, list/export), cash day view, open, close, reopen, sessions list
- [x] Web: expenses (list, add, void, categories), cash closing page (drawer and date, breakdown, open, count and close with live discrepancy, reopen, history)
- [x] Tests: the closing scenario (₹2,000 + ₹5,000 − ₹500 − ₹3,000 = ₹3,500), discrepancy, locked day refuses postings, reopen, opening carry-forward, expense rules and voids, sales untouched, roles

### Phase 11 review
- Exit criteria met: opening ₹2,000 + a ₹5,000 cash sale − a ₹500 cash expense − a ₹3,000 deposit to the bank gives ₹3,500 expected.
  - A count of ₹3,400 is recorded as −₹100 (short), and the day's sales are unchanged by closing.
- Also tested:
  - A closed day refuses cash sales, expenses and transfers on that drawer and date. Other accounts and other dates still work.
  - Only admins can reopen, and the old count stays in the audit log.
  - The opening amount carries forward from the last count.
  - Voided receipts and expenses net out of the expected cash.
  - Bank accounts and future dates can't be closed.
  - Order expenses need an order, voids happen once, and expenses never touch sales.
  - Cashiers can close the drawer but not record expenses.
- Browser: recorded a ₹120 cash expense, opened the drawer with ₹2,000, saw the breakdown (cash received, the expense, the ₹100 deposit from phase 7), entered a count with the live short/over badge, closed (locked notice, history row), reopened with a reason, expense categories, mobile cash page. No console errors.
- Found while verifying: four unescaped apostrophes in the new screen's text (lint), now fixed.
- Permission added: `cash.reopen` (admin). The base seed now adds default expense categories.

## Phase 12 — Stock reconciliation

- [x] Schema: StockCount (location, optional category, blind, status flow, links to the adjustment document) and StockCountLine (system snapshot, counted, reason); ADJUSTMENT documents tagged with the count
- [x] Rules: sellable stock is counted; the snapshot is taken when the count starts; blind counts hide system figures from counters; all lines counted before submitting; admin approval posts one adjustment (found units at average cost, missing units at average cost) through the stock engine; send back for a recount; cancel; reverse an approved count from the count (not from Inventory)
- [x] API: create (lines generated), save counts, add a found item, submit, send back, approve, cancel, reverse, list and detail
- [x] Web: stock counts list and new count, counting sheet (blind-aware), review with differences, reasons and value impact, approve, reverse
- [x] Tests: Scenario H (correction in the ledger and the audit log; reversal works), blind visibility, found item, submit rules, recount, roles, no-difference approval, double approval

### Phase 12 review
- Exit criteria met (**Scenario H**): a blind count finds 8 of 10 units.
  - On approval the −2 correction posts as an ADJUSTMENT tagged with the count, and shows in the ledger and the audit log (approved by whom, the posting, the differences).
  - The Inventory screen refuses to reverse it directly. Reversing from the count restores 10 units with a REVERSAL document, and the count can't be reversed twice.
- Also tested:
  - Blind visibility (counters see no system figures or costs).
  - Found units come in at the average cost, including an item added mid-count.
  - Every line must be counted to submit, and a count can be sent back for a recount.
  - A count with no differences approves without a document, and two simultaneous approvals give exactly one.
  - Lines lock at the DB.
  - Empty counts are refused, cancelled counts stay on record, and cashiers are kept out.
- Browser: ops started a blind Godown count of Stanley tumblers and submitted it, with no system column visible. The owner reviewed it (system, counted, difference, value −₹2,900, reason per line), approved (adjustment STK-00019), reversed (STK-00020) and checked both in the ledger. Mobile list. No console errors.
- Found while building: a schema edit placed the location relation on the User model by mistake (caught by `prisma validate` and fixed before migrating), and the list DTO's `lines` count clashed with the detail's `lines` array (renamed `lineCount`).
- Inventory's reversal is now split into `reverseDocumentInTx`, so records that own a stock document (counts) can reverse it themselves.
