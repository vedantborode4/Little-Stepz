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
- [x] **13. Profit, valuation, dashboard & reports** — profit waterfall, projections, dashboard, 17 reports (Scenario I)
- [x] **14. Import, website sync & go-live** — import wizard + rollback, read-only website pull, VPS deploy, backups, restore drill, tech spec

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

## Phase 13 — Profit, valuation, dashboard & reports

- [x] Profit waterfall: gross sales → discounts → returns → net sales excl. GST → COGS → realised gross profit and margin → shipping expense, payment fees, order expenses → contribution profit → operating expenses → operating profit (labelled not final accounts); price reductions below list price
- [x] Profit by product, variant, category and channel, net of returns; unknown-cost units counted, never priced
- [x] Valuation and projections per variant: available units, average landed cost, cost value, regular-price and offer-price scenarios (before GST and net of GST), live from current prices
- [x] Dashboard: inventory, sales (today, yesterday, month, lifetime, retail vs wholesale, online vs offline), payments, profit, customers and shipping KPIs; trend, collections, top products and category mix charts; category/product filters; role-aware
- [x] The 17 reports with filters, preview and CSV/Excel; PII masked; financial reports admin-only
- [x] Tests: waterfall figures end to end, breakdown net of returns, Scenario I (offer price change moves the projection, past sales unchanged), valuation with unknown costs, every report runs and exports, role gates

### Review (phase 13)

**Built.**
- **API:**
  - `modules/analytics` covers the profit waterfall, breakdown by product, variant, category or channel, valuation with regular and offer scenarios, and a role-shaped dashboard.
  - `modules/reports` is a registry of all 17 reports with preview and CSV/Excel export.
  - Everything is computed live from the existing ledgers; there are no new tables or migrations.
- **Web:**
  - The home page is now the KPI dashboard, with category and product filters, a 30-day sales trend (recharts, single series), and bar lists for collections, top products and category mix.
  - Profit & Analytics has two tabs: the profit statement with breakdown, and valuation & projections.
  - The Reports page has a grouped report list, per-report filters, a preview and export.
- `SHIPPED_PHASE` is 13.

**Decisions.**
- Gross profit covers only lines with a known cost. Unknown-cost units are counted and flagged everywhere, never assigned a guessed cost.
- Courier cost is matched to orders fulfilled in the range. Fees and expenses are matched by their own date, net of voids.
- Headline sales on the dashboard always cover the whole business. The category and product filters scope stock, the trend and top products.
- Ops has no `reports.view`, so it has no Reports page. Cashiers see operational reports without cost columns, and never the financial ones.

**Verification.**
- crm-api `tsc` and build pass. crm-web `check-types` and lint (0 warnings) pass.
- **Tests:** 176 pass, twice in a row.
  - The new `analytics.test.ts` covers:
    - The waterfall end to end: sale, offer price, item discount, return, delivery order with gateway fee, courier cost, order expense, operating expense and a voided expense.
    - The breakdown net of returns.
    - Scenario I.
    - Valuation with unknown costs.
    - Dashboard shaping per role.
    - Every report previewing and exporting.
    - Report and analytics role gates.
    - Daily sales matching the sales summary.
  - Also fixed a pre-order test that read only the first 100 board rows; it broke once earlier runs had left enough open pre-orders behind.
- **Browser** (admin, cashier, phone width):
  - The dashboard figures reconcile with the profit statement. For example, ₹44,150 − ₹1,549 − ₹449 = ₹42,152 net incl. GST.
  - The cashier dashboard has no profit or cost tiles, and its report list has no financial reports. `/analytics` is blocked for the cashier.
  - Fixed during the walkthrough:
    - Two date presets were highlighted when they covered the same days.
    - Report money columns now show paise consistently.

## Phase 14 — Import, website sync & go-live

- [x] Import wizard: upload CSV/XLSX → map columns (suggested from templates and header names, saveable as templates) → every row checked with the form schemas → duplicates and unknown SKUs flagged → approve in one transaction (re-checked first) → batch history → rollback while unused
- [x] Three imports: products & variants, opening stock (blank cost stays unknown), customers (blank details stay empty)
- [x] Website sync, read only: off / mock / live sources, dry run report (links, conflicts, website-only, differences, orders), ID linking from a reviewed dry run on the live source only; append-only run history
- [x] Website export endpoints specified (docs/crm/WEBSITE_SYNC_CONTRACT.md); the website code is unchanged
- [x] Deploy artifacts: PM2 ecosystem, nginx + TLS site, production env samples, deploy script, cron
- [x] Backups: nightly verified pg_dump with checksum and off-server copy; restore script that defaults to a scratch DB; restore drill run and passing
- [x] Docs: TECH_SPEC, RUNBOOK, PRODUCTION_CHECKLIST, RUNNING, DATA_MODEL
- [x] Tests: imports (mapping, checks, duplicates, approval, re-check, rollback and its guards), sync (plan, link only what was reviewed, failures recorded, append-only), guards

### Phase 14 review

**Built.**
- **Schema:** `ImportTemplate`, `ImportBatch`, `ImportRow` and `SyncRun`. Import history can't be deleted, and sync runs are append-only.
- **API refactors** so an import approves in one transaction: `createProductInTx`, `createCustomerInTx` and `recordOpeningStockInTx` (with a source). The import's opening stock is owned by the batch, so Inventory refuses to reverse it directly.
- **Web:** Import Data (history and upload), the import wizard (mapping, row review with filters, approve, rollback), and Settings → Integrations (website card with dry run and plan, sync history, "Not connected" placeholders).
- **Hardening:** the API now binds to 127.0.0.1 by default (`HOST`). `WEBSITE_SYNC_MODE=mock` is refused in production, and live mode refuses to start without its URL and key.
- **Go-live files:** `deploy/crm/` (ecosystem, nginx, env samples, deploy, backup, restore, restore drill, table counts, crontab).

**Decisions.**
- **Rollback of products archives them, it doesn't delete them.** Price history is append-only. The SKUs become `SKU~IMP-xxxx`, a character real SKUs can't contain, so a corrected file can reuse them.
- **Unknown categories and brands are errors**, not created on the fly, so a typo can't make a new category.
- **A product is imported whole or not at all.**
- **Website orders are counted, not imported.** Importing them needs real data and order lines. The contract lists the extra field.
- **No website data has been read.** The only source used is the built-in SAMPLE data, and the UI says so.

**Verification.**
- **Builds and checks:**
  - crm-api `tsc` and build pass.
  - crm-web `check-types`, lint (0 warnings) and a production `next build` pass.
- **Tests:** 186 pass, twice in a row. 10 are new (7 import, 3 sync).
- **Production env guard:** with `NODE_ENV=production`, mock and half-configured live modes are refused.
- **Browser (admin):**
  - A products CSV with an unknown category, an existing product and a repeated SKU showed exactly those rows. 3 rows were imported as 2 products.
  - An opening-stock CSV posted into Store, with blank cost kept unknown.
  - A customers CSV flagged the seeded customer's mobile as a duplicate; the other row was imported, then rolled back.
  - The integrations dry run on demo data proposed 7 links and refused linking. History and the mobile layout were checked.
  - Fixed during the walkthrough:
    - The redundant "Category: Choose a category" next to "Unknown category".
    - "1 rows" and "1 errors".
    - SKUs wrapping mid-code.
- **Restore drill:**
  - Ran locally against `crm-postgres`: backup (verified with `pg_restore --list`, SHA-256) → restore into a scratch DB.
  - 54 tables and 659 rows matched; the stock ledger matched balances; 26 append-only/no-delete triggers present; scratch DB dropped.
  - `restore.sh` refuses to overwrite the live DB without `CONFIRM_LIVE_RESTORE=yes`.
- **Security sweep:**
  - No raw-SQL `Unsafe` calls and no raw HTML.
  - Every router except auth is permission-gated; refresh cookie is httpOnly + SameSite=Strict.

**Not done here (needs the VPS or the owner).**
- Server install, TLS, off-server bucket, and the drill on the VPS.
- Real files from the owner.
- The website export endpoints.
- CA-confirmed GST rates.

These are tracked in PRODUCTION_CHECKLIST.md. The CRM is not called production-ready until that list is ticked on the server.


---

## Round 2: owner feedback (2026-10-31)

Decisions (owner, 2026-10-31):
- The sidebar opens the new first tab.
- Product photos: gallery plus per-variant photos.
- Import refinements are on hold; next will be more import types.
- Website catalogue access will go through the website export API (spec only this round).

### Quick fixes
- [x] **1. Modal footer padding.** `.safe-area-pb` uses `env(safe-area-inset-bottom, 12px)`. The fallback never applies (browsers report 0), and as unlayered CSS it beats `sm:pb-4`, so every modal footer has 0 bottom padding. Fixed in the modal footer with `pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-4`. The class is left alone for the bottom nav, which relies on it being 0 (the POS checkout bar sits 60px above).
- [x] **4. Newest sales first.** The sales list sorts by `orderDate` (date only), and ties fall back to the random UUID `id`, so same-day sales come out shuffled. `buildOrderBy` takes an optional `thenBy`; sales and purchases pass `createdAt`, and the pre-order history got the same tie-break. The other date lists already had it.
- [x] **5. Payments tabs.** Collections first, then Payments. `/payments` opens Collections; the payments list moves to `/payments/list`.
- [x] **9. Analytics tabs.** Valuation & projections first, then Profit. `/analytics` opens Valuation; Profit moves to `/analytics/profit`.

### Features
- [x] **2. Dashboard filters.** Today only the inventory cards and the 30-day trend honour category/product. Scope these as well:
  - Sales cards (today, yesterday, month, lifetime) and both splits.
  - Profit cards: gross profit, discounts, potential.
  - Valuation by product.
  - Top products and category mix.

  Payments are per order, not per product, so that section stays whole-business and is labelled so when a filter is on. Contribution profit (courier and fees are per order) is hidden when filtered.
- [x] **3. Add-customer button.** A visible "add customer" button attached to the customer field, in both POS and the order form (shared `CustomerSelect`).
- [x] **6. Product photo gallery.** A `ProductImage` table with an optional variant per photo, uploaded to Cloudinary through crm-api (same account as the website, `littlestepz-crm/` folder; the CRM never deletes assets it didn't upload). Reorder, set the main photo, delete. `Product.imageUrl` stays as the main photo, so lists, POS and stock screens keep working.
- [x] **7. Add buttons on Shipping and Returns.** Pick an order (eligible ones only), then reuse the existing create-shipment and return modals.
- [ ] ~~8. Import refinements~~: on hold (next: more import types).

### Answers to write up
- a. Advances held.
- b. Syncing website products and variants.
- c. New stock count.
- d. The shipping flow.

### Deliverable
- [ ] Simple user manual for owner and staff, written after the changes, so it matches the screens.

### Review (2026-10-31)

**Verification**
- **Tests:** crm-api suite 193/193 passed before the last tweak. Analytics re-run after the top-variant label change: 13/13.
- **New tests:**
  - A product filter counts only that product's lines in a mixed order.
  - Same-day sales list newest first (fails at random without the fix).
  - `readyFor` offers only eligible orders.
  - Photo upload, link, reorder and remove, against a fake Cloudinary.
- **Typecheck and lint:** crm-web `check-types` and lint (0 warnings) pass; crm-api `tsc` passes.
- **Browser** (CDP, signed in as owner):
  - Modal footer: 16px padding (12px on phone).
  - The add-customer button is inside the customer field on POS and the order form.
  - Dashboard filtered to YEGAO shows only its lines; payments and customer cards are marked whole business.
  - Tabs swapped; the old `/payments/collections` redirects.
  - New shipment and New return pickers open the existing forms.
  - Gallery on desktop and phone: link photos, Main badge, variant photo, make main.
  - Uploading without Cloudinary keys returns IMAGE_UPLOADS_OFF.
  - The test photos were removed afterwards.

**Not done / needs the owner**
- **Cloudinary keys** aren't in `apps/crm-api/.env`, so real uploads haven't been tried. Copying the website's keys is the owner's call.
- **Creating missing products from the website** is specified in WEBSITE_SYNC_CONTRACT.md (options, photos as links, no stock) but not built. It needs the website export endpoints first.
- **Import refinements** are on hold.

## Production review fixes (2026-10-31)

`/code-review` of `main...crm` found 10 issues. All are fixed:

- [x] **1. Late purchase charges missing from profit.** The share for units already sold (`toCostOfSales`) now counts as COGS on the charge's date. It flows into the sales summary (dashboard, waterfall and period reports) and the profit breakdown. By channel it shows as its own "Late purchase charges" row. The waterfall says how much of COGS it is.
- [x] **2. Stock counts double-counting stock that moved while open.** Each line's system figure is re-taken when the line is counted, so movements before counting aren't counted twice and movements after it stand.
- [x] **3. Cash day closing past an in-flight payment.** `assertCashDaysOpen` now share-locks the session rows, so it serialises with `closeDay`'s FOR UPDATE.
- [x] **4. Link IDs failing when one website product spans two CRM products.** The dry run now tracks product links it proposes, both ways and by id. The second CRM product is reported as a conflict.
- [x] **5. Large counts timing out.** Count create, save, approve and reverse run with a 120 s transaction timeout.
- [x] **6. Credit terms never enforced at the till.** Blank credit days now means the customer pays in full at POS (`CREDIT_NOT_ALLOWED`). With a credit limit, what they owe on handed-over orders plus this sale can't pass it (`CREDIT_LIMIT_EXCEEDED`, with the customer row locked).
- [x] **7. Voided payments showing "Refunded".** "Refunded" now needs a refund that still stands, or value given back as credit. A void's mirror row or a voided refund doesn't count.
- [x] **8. Import rollback check racing new uses.** The blocker check now runs inside the rollback transaction, after `lockForRollback` locks the variant, customer or stock-balance rows that any new use must touch.
- [x] **9. Pre-orders loaded twice.** The search is applied in memory; waiting items look up stock once per location.
- [x] **10. Duplicated decimal helpers.** `decOrZero` and `round2` now come from `core/money`.

**Found while testing.** The customer duplicates list ranked pairs with no PIN, or with only one PIN, as "same PIN". `IS NOT DISTINCT FROM` matched null = null, and NULL sorts first in a descending sort. It now uses `COALESCE(a.pincode = b.pincode, false)`.

**Verification**
- crm-api: 196/196 tests pass, and the build passes. New tests cover fixes 1, 2, 4, 6 and 7, plus the voided-payment status.
- crm-web: typecheck and lint pass.
- Test customers that buy on credit now have credit days, as the new rule requires.

### Second review of the fixes (2026-10-31)

- [x] **Credit check stall.** The credit check read what the customer owes on a second connection while holding the lock. It now reads inside the sale's transaction (`outstandingSummary(query, tx)`).
- [x] **Rollback lock order.** The opening-stock rollback locked rows in the opposite order to the stock engine. It now uses the engine's `lockVariants`, which also covers balance rows that don't exist yet.
- [x] **Blank channel label.** Profit by channel falls back to the row's own label.
- [x] **POS lock order.** A POS sale with a customer now takes the customer lock first (`lockCustomer`, now exported) before any stock lock, like returns do.
- [x] **Deadlock retries.** `withTransaction` now also retries deadlocks and serialization failures raised by raw lock statements (P2010 with 40P01/40001).
- [x] **Count corrections.** A corrected count line keeps the system figure from when it was first counted. Clearing the line and counting again takes a fresh one.
- [x] **Late charges and gross profit.** Late purchase charges for units no longer in stock moved out of COGS and gross profit, which only cover known-cost sales. They are now their own waterfall line (`lateCharges`) before contribution profit, and are out of the per-product breakdown.
- [x] **Unused refund lookup.** `orderPayments` became `orderPaid` and no longer runs the refund query, which no caller read.
- [x] **Pre-order search.** It's back to one Prisma filter, run over the open ids only.
- [ ] **`tasks/todo.md` stash-conflict markers.** These are from non-CRM work stashed before this session. The file has never been staged in a CRM commit, and resolving it needs the owner.

**Verification**
- crm-api: 197/197 tests pass, and the build passes.
- crm-web: typecheck and lint pass.


## Real data migration (2026-11-01)

The source is the owner's workbook `Little_Stepz_Complete_Dashboard_31_Oct_2026.xlsx`.

**Owner decisions**
- The workbook is the source of truth.
- Categories: all 13 of the workbook's categories, exactly as named.
- Brands: exactly as listed. "(No brand)" means the product has no brand.
- The local SAMPLE/demo data is discarded.
- The run goes on the local database first, and on production only after that.
- Doubtful data is sent to the client before import. Product images are skipped for now.
- Everything in the sheets goes into the CRM.
- GST: one rate per category, which a product can override with its own rate.

**Client inputs.** These come back in `Little_Stepz_Client_Questions_01_Nov_2026.xlsx`:
- GST for each category, with product overrides.
- Missing prices, costs and names.
- Shelf count by location, including demo and damaged pieces.
- 13 bills that are owing or overpaid.
- Which account each payment method goes to, and the channel for each bill.
- Customer mobile numbers.
- Dates for the setup expenses, and which ones are assets.
- The 193 open questions from the old sheet.
- Stock movements with missing details.
- Supplier balances. The CRM doesn't track these.

**Build**
- [x] **Import fixes.**
  - A file over 5 MB gets a clear "file too large" message, not a 500.
  - The user picks which sheet to import.
  - The header row is found under title rows, or picked by the user.
  - Merged-cell copies are not treated as duplicate headers.
- [x] **GST by category.**
  - Each category has a default GST rate.
  - Products follow the category rate unless they have their own override.
  - Changing a category's rate updates every product that follows it, with an audit entry.
  - The product form shows "Use category rate" or a custom rate.
  - In the products import the GST column is optional.
- [x] **Clean baseline.** (Code done. Resetting the local database is waiting for the owner's explicit yes; Prisma refuses an AI-run reset without it.)
  - The base seed stops creating the 7 demo categories.
  - The expense categories come from the workbook's list.
  - The local database is reset to migrations plus the base seed, with no `seed:demo`.
- [x] **Products import creates missing categories and brands.** The preview lists the new ones before anything is approved.
- [x] **New import type: historical sales.**
  - Rows are grouped into bills by bill ID.
  - Each bill is dated and recorded as completed (fulfilled) on its sale date.
  - Lines keep the price charged, the discounts and the landed-cost snapshot. A blank cost stays "unknown".
  - Payments are dated on the sale date and go to the account mapped for each method.
  - Each bill carries its channel and its customer.
  - Courier charges become expenses linked to the order.
  - Stock is **not** moved, because the cut-over count already reflects these sales.
  - Imported bills are marked as imported, and the batch can be rolled back.
- [x] **New import type: expenses** (the 39 setup costs).
- [ ] **Import files.**
  - The CRM import files are built from the workbook plus the client's answers.
  - The one later payment (₹12,200, 6 Oct) is entered on its bill.
  - The ₹200 exchange refund is entered as a refund.
- [ ] **Dry run on the local database.**
  - Order: products, then the opening stock count, then customers, then history, then expenses.
  - Owner approves each batch.
  - Totals are reconciled against the workbook:
    - Sales: ₹5,81,475 across 208 bills.
    - Received: ₹5,82,185.
    - Stock at landed cost: from the shelf count.
- [ ] **Production run**, after the local run is signed off.

**Not mapped.** Supplier balances have no home in the CRM (supplier payables were out of scope):
- The Hot Wheels supplier credit of ₹20,420, and the 2 cases still owed.
- The Anil Ji credit of ₹8,573.70 and the RMB ledger.

These wait for the owner's answer on sheet 11.

**Review of the build (2026-11-01)**
- Imports read one sheet of a workbook. If the file has several sheets, the import asks which one. It finds the headings row under titles and group labels: the first row near the top that is nearly as full as the fullest. Row numbers match Excel.
  - A file over 5 MB now gets a 413 `FILE_TOO_LARGE`. Before, this was a 500 "Something went wrong".
  - Merged-cell copies, columns without a heading and repeated headings no longer break the upload.
- GST by category:
  - `Category.gstRate` and `Product.gstFromCategory` were added.
  - Sales still snapshot `Product.gstRate`, which is kept equal to the category's rate while the product follows it.
  - A category rate can't be cleared while products follow it.
- The base seed no longer creates categories. Expense categories are the workbook's list, plus Courier and Packaging.
- Past sales import (`HISTORICAL_SALES`):
  - Each bill becomes a completed sale on its own date with `importBatchId`, its payments on that date (no invented gateway fee) and its courier charge as an order expense.
  - Stock is not moved. A cost is written only if the file gives one; otherwise the line counts as unknown-cost units.
  - A walk-in bill must be paid exactly. A named customer may owe the rest, or keep any excess as credit.
  - These are locked money records, so the batch can't be rolled back.
- Expenses import: categories are matched by name. Accounts are matched by name, or by method when that names exactly one account; anything ambiguous is refused with the choices. Rollback voids each expense.
- Verification:
  - crm-api builds, and 202/202 tests pass. New tests cover sheet choice, header detection, the size limit, past sales, expenses and category GST.
  - crm-web typechecks and lints.
  - Driven in Chrome against the test database: sheet picker, mapping with account choices, the check summary, the category GST field and the product GST choice.

## Owner answers and supplier balances (2026-11-01)

**Owner decisions**
- **GST.** Every category is 0%. Past **Website** bills carry 18% GST; every other bill carries 0%.
- **No selling price (8 products).** The price is ₹11, a marker that tells the owner to set the real one.
- **Placeholder products (15 PEND-/BUNDLE- rows).** Imported with price ₹1 and no stock.
- **Other product details.**
  - A blank landed cost stays blank.
  - Loss-making prices are kept.
  - Doubtful names are imported as they are.
- **Stock.** Flagged shelf rows and products below zero start blank (zero); the client counts them in the CRM.
- **Setup expenses (39).** All dated 22 Aug 2026 with the note "date to be set", paid from a new personal account, "Owner – setup funds".
- **Customers.** Imported by name only, with no mobile number.
- **Bills.**
  - Walk-in bills that were paid short or paid extra go on one customer, "Old sheet – unnamed customers".
  - OCT24-001 uses its actual line prices (₹4,300 billed, ₹3,800 received, ₹500 due).
  - The 16 suspected duplicates are imported as they are.
- **Payment accounts.** Left to the owner. How the old sheet's PhonePe, Cash and Online columns land is confirmed before the sales import.
- **Supplier balances.** Tracked in the CRM as a supplier ledger.

**Plan**
- [x] **Per-bill GST in the past-sales import.** Add an optional "GST %" column that overrides the product's rate for that line.
- [x] **Supplier ledger: data.**
  - Add an append-only `SupplierLedgerEntry` table. Each entry has a type: opening balance, payment to supplier, goods received, refund from supplier, credit note or adjustment. It also carries a date, an optional account and an optional purchase link, and can be voided by a reversal row.
  - The balance is positive when the supplier holds our money, negative when we owe them.
- [x] **Supplier ledger: money.**
  - Payments and refunds name the account the money moved through.
  - Cash closing counts them, and closed cash days are refused.
  - They are never expenses or sales.
- [x] **Supplier ledger: API.**
  - The supplier's ledger with its balance.
  - Record an entry, and void an entry.
  - Balances on the supplier list.
  - A "Supplier balances" report.
  - A new admin-only permission, `suppliers.ledger`.
- [x] **Supplier ledger: web.**
  - A supplier page with the balance, the ledger, a record-entry form and void.
  - A Balance column on the supplier list.
  - The report.
- [x] **Tests** for balances, voids, cash closing, closed days and permissions.
- [x] **Converter.** Turns the owner workbook and these answers into import files: products, opening stock, customers, past sales and expenses, plus the supplier opening balances (Hot Wheels supplier ₹20,420 in our favour, which includes the 2 Mainline cases still owed, and Anil Ji ₹8,573.70).
- [ ] **Local dry run.** Only after the owner clears the files; reconcile the totals. (Rehearsed on a throwaway database, see below; waiting for clearance and the payment accounts.)

**Review (2026-11-01)**
- **Past-sales GST.** The past-sales import takes an optional "GST %" per line; blank uses the product's rate. Rates outside the GST list are errors. The same item twice on a bill must also agree on GST.
- **Supplier ledger.**
  - The `SupplierLedgerEntry` table is append-only, with a trigger and a `CHECK` tying the sign to the type and the account to payments and refunds. Voids are reversal rows dated today. There is one live opening balance per supplier, kept race-free by locking the supplier row.
  - The ledger shows a running balance (a SQL window over date and recording time), and the type totals net out voids.
  - Cash closing subtracts supplier payments made in cash, and a closed day refuses them.
  - A new `suppliers.ledger` permission (admin only) controls balances on the supplier list, the supplier page, the ledger export and the "Supplier balances" report.
- **Converter.** `apps/crm-api/scripts/convert-owner-workbook.ts` reads the workbook and writes the import files: products, opening stock, customers, past sales, later payments, setup expenses and supplier balances, plus `summary.txt`. It only writes files.
  - The empty bill OCT31-006 (no items, no money) is left out.
  - SEP29-004 sold one item on two rows a rupee apart (2 × ₹633 + 1 × ₹634). It becomes one line, 3 × ₹634 less ₹2, so the bill stays ₹1,900.
  - Letter Heads Printing (₹0) is left out. Setup costs are not inside landed cost (the Product Master allocation column is empty), so they are not counted twice.
- **Rehearsal.** Run on a throwaway database (`crm_rehearsal`, since dropped) through the API with the real files. Every batch checked with 0 errors and 0 duplicates. Results:
  - 207 bills, ₹5,85,775 in sales; GST ₹2,744.37 on the Website bills; ₹5,82,185 received.
  - ₹5,899 still owed and ₹2,309 held as customer credit. The difference, ₹3,590, equals sales minus money received.
  - Courier ₹9,429 and setup ₹4,36,269.
  - 21,086 pieces in stock.
  - Supplier balances ₹28,993.70.
  - 100 products / 102 variants, 13 categories at 0%, 13 brands, 8 customers.
- **Verification.**
  - crm-api builds, and 206/206 tests pass, with new tests for per-sale GST and the supplier ledger.
  - crm-web typechecks and lints.
  - Driven in Chrome against the rehearsal data: supplier list with balances, supplier page, recording a payment with its balance preview, entry detail, cash closing line, report, mobile and dark.
- **Waiting on the owner.**
  - Clearance to import into the local database.
  - Which accounts the old sheet's PhonePe, Cash and Online money and the courier charges go to.
