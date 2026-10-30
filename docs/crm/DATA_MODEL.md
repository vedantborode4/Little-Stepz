# CRM data model

Source of truth: `packages/crm-db/prisma/schema.prisma`. This page explains the intent behind it and is updated each phase.

## Conventions

- **Ids:** UUID primary keys. Human-readable document codes (e.g. `PRD-0001`) arrive with the modules that need them.
- **Money:** `Decimal(14,2)`. Unit costs and exchange rates are `Decimal(18,6)`. Quantities are integers.
- **Time:** timestamps are stored in UTC. The business day is calculated in IST.
- **Append-only tables:** protected by the `crm_reject_mutation()` trigger, which rejects UPDATE, DELETE and TRUNCATE.
- **Master data** (locations, accounts, users) is deactivated, never deleted, so history stays intact.

## Phase 1: identity and settings

| Model | Purpose | Key rules |
|---|---|---|
| `User` | CRM login (ADMIN / CASHIER / OPS) | Email is unique and lower-cased. `mustChangePassword` is set by admin create/reset. Locked for 15 min after 5 failed logins. At least one active admin always remains. |
| `RefreshToken` | Long-lived session, stored as SHA-256 hash | Rotated on every refresh, grouped by `familyId`. Replaying a rotated token revokes the whole family. Role change, deactivation and password reset revoke all of a user's sessions. |
| `AuditLog` | Who changed what, with before/after JSON | **Append-only.** Written in the same transaction as the change. Secrets (`passwordHash`, tokens) are stripped. |
| `BusinessProfile` | Single row (`id = "default"`) | `stateCode` (GST) decides intra-state vs inter-state tax later. |
| `Location` | Stock locations: Store, Godown | `code` can't change after creation. At least one active location always remains. |
| `ReceivingAccount` | Where money lands: cash drawer, PhonePe business/personal, gateway, bank | `isPersonal` keeps personal receipts reportable but separate. `feePercent` feeds contribution profit. |

## Phase 2: catalog

| Model | Purpose | Key rules |
|---|---|---|
| `Sequence` | Gapless per-prefix document numbers (`PRD-0001`) | Incremented inside the creating transaction, so a rollback never burns a number. |
| `Category`, `Brand` | Product grouping | Names are unique case- and space-insensitively (`nameKey`). Deactivated, never deleted. The 7 owner-specified categories are seeded. |
| `Supplier` | Who invoices you, and in which currency (INR/CNY/USD/HKD) | Unique name. The full suppliers screen ships with Purchases (phase 4). |
| `Product` | The sellable item: category, brand, scale, supplier, GST rate + HSN, image URL, description/notes, `websiteProductId` | Never deleted, only `ARCHIVED`. `websiteProductId` is a reference only; nothing is written to the website. |
| `ProductOption` / `ProductOptionValue` | e.g. Colour → Red, Blue, Black, White | Dimensions are fixed after creation; new values can be added. |
| `Variant` | One sellable combination with its own **SKU**, regular/offer/wholesale price and reorder level | **Every product has ≥ 1 variant** (a simple product has one "Default" variant). The SKU is unique (stored upper-case). `optionKey` stops the same combination from being created twice. A DB `CHECK` enforces price > 0, offer ≤ regular and wholesale ≤ regular. A product always keeps at least one active variant. |
| `PriceTier` | Wholesale quantity breaks: ≥ `minQty` units at `price` each | Quantities rise and prices never rise. A tier is never above the regular price. |
| `PriceChange` | History of every list-price change: single edits, bulk batches (`batchId`) and opening prices | **Append-only** (trigger). Records who, when and why. Completed sales keep their own snapshot (phase 6). |

**Bulk price edit:** preview first, then apply. Apply re-checks every row against the price the user saw, under row locks, and rejects the whole batch if any price changed in the meantime.

**Website mapping states:** product id and every active variant id set = *Mapped*; none set = *Not mapped*; anything in between = *Partly mapped*.

## Phase 3: inventory ledger

| Model | Purpose | Key rules |
|---|---|---|
| `StockDocument` | One stock event: opening, transfer, status change, write-off, adjustment, reversal (purchase and sale arrive in phases 4 and 6) | **Append-only.** It carries a business date (IST calendar day, never in the future), reason/reason code, reference and author. A correction is a `REVERSAL` document (`reversalOfId` is unique, so at most one per document). A reversal can't itself be reversed. Documents created by a purchase or sale are corrected there instead. |
| `StockMovement` | Signed quantity for one variant × location × bucket, with the unit cost it moved at | **Append-only.** Quantity is never 0. `unitCost` is null when the cost is unknown, and internal moves carry no cost. |
| `StockBalance` | Running balance cache per variant × location × bucket | Written only in the same transaction as its movements. Removals are guarded (`quantity >= n`) and a DB `CHECK (quantity >= 0)` backs that up, so stock can never go negative, even under concurrent requests. |
| `VariantCost` | Moving weighted-average cost per variant: `valuedQty`, `totalValue`, `unvaluedQty` | Row-locked (in sorted order) for every posting, which serialises all stock writes per variant. Units with an unknown cost are kept out of the average and leave first. The last valued unit out removes all remaining value, so rounding leaves no residue. |

**Buckets.** Physical stock is SELLABLE + DAMAGED + DEMO + QUARANTINE. **Available** is SELLABLE − reserved; reservations arrive with sales in phase 6. A status change is a two-leg move, so physical stock is unchanged, and a write-off then removes the units. Nothing is counted twice.

**Reconciliation, per variant:** closing physical = opening + purchases + sales returns − sales − purchase returns − write-offs ± adjustments. Transfers and status changes net to 0. Reversals count against the type they undo.

**Single writer.** Only `postStockDocument` (in `modules/inventory/stock-engine.ts`) writes stock tables. Purchases and sales will call it.

**Integrity tests assert** that the sum of movements equals the balances for every key, and that costed units equal physical units for every variant.

## Phase 4: purchasing and landed cost

| Model | Purpose | Key rules |
|---|---|---|
| `PurchaseShipment` | One supplier invoice or shipment: supplier, invoice and BL/AWB refs, invoice date, **currency + exchange rate entered per purchase**, allocation method, receiving location | `DRAFT` (editable) → `RECEIVED` or `CANCELLED`. After `DRAFT`, a trigger rejects every UPDATE and DELETE. Receiving runs under a row lock, so a purchase can't be received twice. |
| `PurchaseLine` | Variant, quantity, unit price in the purchase currency, optional kg/CBM per unit | Unique per variant in a purchase. At receipt it freezes `unitPriceInr`, `allocatedCharges` and `landedUnitCost`. A trigger locks it once the parent is no longer a draft. |
| `ShipmentCharge` | Freight, customs duty, clearing, IGST, GST, transport, insurance, other; in INR or the purchase currency (converted at the purchase rate) | `isRecoverableTax` charges (IGST/GST by default) are **kept out of inventory cost** and reported as input tax credit. Locked with the parent. |
| `CostAdjustment` (+ lines) | A charge that arrived after receipt | **Append-only.** Split by the chosen method. For each line, the share for units still on hand revalues stock (`revalueStock`) and the rest goes to cost of sales. Recoverable tax is only recorded. |
| `PurchaseReturn` (+ lines) | Goods sent back to the supplier from a received purchase | **Append-only.** Can't exceed received − already returned. Posts a `PURCHASE_RETURN` stock document at the current average cost. |

**Landed unit cost** = unit price × exchange rate + (allocated non-recoverable charges ÷ quantity).
- Charges are split **by purchase value** by default (duty is value-based), or by quantity, weight or volume.
- The last line takes the rounding remainder, so the parts always add up to exactly the charge total.
- Receiving posts a `PURCHASE` stock document (`sourceType = PURCHASE`) at the landed cost, which feeds the weighted average.
- Purchase stock documents can only be corrected from the purchase (a late charge or a return), never reversed in Inventory.

**Exchange rates** are never hard-coded. The form offers the last rate used for that currency as a one-click suggestion, never applying it automatically.

## Phase 5: customers

| Model | Purpose | Key rules |
|---|---|---|
| `Customer` | Retail or wholesale customer: `CUS-xxxxx` code, mobile, WhatsApp, email, address, GST state, PIN, credit days and limit, notes | `mobile` is stored in **E.164** and is **unique**: "98765 43210", "098765-43210" and "+91 98765 43210" are the same number. A DB `CHECK` refuses any phone not in E.164, so a script that bypasses the shared schema fails loudly instead of defeating the duplicate check. Walk-in sales have no customer. |
| `CustomerPrice` | Negotiated price for one customer × variant | Wins over every list price (phase 6 price resolution). Set by admins (`products.manage`). Audited set/remove. |

**Duplicates.** Saving a mobile that already exists is blocked (`MOBILE_TAKEN`). The form also warns, as you type, about the same name at the same PIN code or a similar name (`pg_trgm` similarity on `nameKey`). Admins get a "Possible duplicates" list of similar-name pairs.

**Merge** (admin, `customers.merge`): the duplicate becomes an inactive pointer (`mergedIntoId`) to the customer that is kept.
- Its prices move across, but the kept customer's own prices win.
- Missing contact and address fields are filled from the duplicate, and its notes are appended.
- The mobile moves only if the kept customer has none.
- Later phases add their records (orders, payments, credit) to `reassignCustomerReferences`, so nothing is left pointing at the folded customer.
- Both customers get an audit row. A merged customer can't be edited, merged again or merged into.

**Contact privacy.** Lists, profiles, pickers and normal exports show masked contacts (`+91 ••••••3210`, `r•••@gmail.com`) for every role.
- The full values only leave the API through `POST /customers/:id/contact`, which is audited every time, or through an admin's full-contact export, which is also audited.
- Search matches a full number exactly, or the last four digits that are visible anyway. Other fragments don't match, so the list can't be used to work out whose number is whose.

## Phase 6: sales and POS

| Model | Purpose | Key rules |
|---|---|---|
| `SalesOrder` | A sale or order: `SO-<FY>-00001` code (e.g. `SO-2627-00001` for FY 2026-27), type (order / pre-order), channel, fulfilment (counter or delivery), customer (null = walk-in) with the name frozen for receipts, stock location, order/due dates, GST-inclusive totals plus taxable and GST totals | Past `DRAFT` a trigger freezes its amounts, terms, channel, location and dates. Status, fulfilment/cancellation stamps, notes and the customer link (for merges) stay updatable. `fulfilledAt`/`stockDocumentId` can be set once. POS sales carry a unique `idempotencyKey`. |
| `SalesOrderLine` | Price snapshot per item: list regular price, unit price charged and its **source** (customer / tier / wholesale / offer / regular / manual), line discount, share of the order discount, line total, GST rate, taxable value, GST, and the **cost of goods fixed at deduction** | Unique per variant in an order. After `DRAFT` only `cogs`/`unknownCostQty` may be filled in, and only once. Units that left with an unknown cost are counted, never priced. |
| `Reservation` | Units held for a confirmed order line at its location | Not a stock movement: physical stock is unchanged, available drops. Released (`FULFILLED`/`CANCELLED`) exactly once, never deleted. |
| `SalesOrderEvent` | Order timeline (created, edited, confirmed, packed, handed over, dispatched, delivered, cancelled) | **Append-only.** |

**Price resolution** (server only; POS and the order form show what the quote returns): customer price > quantity tier > wholesale price > offer price > regular price.
- Tiers and the wholesale price apply only to wholesale sales, meaning a wholesale customer or the wholesale channel.
- A manual price needs `sales.manage` (admin). Cashiers use discounts.

**GST.** Prices include GST: taxable = total ÷ (1 + rate), rounded half-even, and GST = total − taxable, so the two always add up.
- The order discount is split across lines by value, with the remainder on the last line.
- Shipping charged follows the highest GST rate on the order.
- Delivery to another state is flagged inter-state (IGST); otherwise the receipt splits CGST/SGST in paise.

**Stock flow.**
- **POS:** create, deduct and complete in one transaction.
- **Counter order:** confirm (reserve), then hand over (deduct).
- **Delivery order:** confirm (reserve), pack, then dispatch (deduct), then delivered.
- Fulfilment locks the order row, releases its own reservations, then posts one `SALE` stock document (`sourceType = SALE`) and fixes each line's COGS from the movements.
- The stock engine now refuses any removal from SELLABLE that would leave less than the units reserved there (`STOCK_RESERVED`). So a walk-in sale, write-off or transfer can't take held stock.
- Reservations take the same per-variant lock as stock postings, so two orders can't claim the last unit.
- Cancelling is only allowed before fulfilment and releases reservations. After fulfilment it's a return (phase 9).

**Revenue** is recognised at fulfilment (`fulfilledDate`, IST): handover or dispatch. `GET /sales/summary` reports fulfilled orders only.
- Gross profit = net sales excl. GST − COGS, over lines whose cost is fully known.
- The "before GST" figure (price − cost) is shown alongside it, labelled as such.

## Phase 7: payments and collections

| Model | Purpose | Key rules |
|---|---|---|
| `Payment` | Money received (`IN`) or paid back (`OUT`): `PAY-xxxxx` code, receiving account (method copied at the time), amount, provider fee, reference, business date, customer | **Append-only.** The only allowed update is re-pointing `customerId` when customers merge (trigger compares the row minus that column). A mistake is voided by a mirror row in the other direction (`reversalOfId`, at most once). `fee ≤ amount`. |
| `PaymentAllocation` | Money applied to an order, from a payment **or** from customer credit (exactly one), signed | **Append-only.** The sum per order is what it has been paid; status (Unpaid / Partially paid / Paid / Overpaid / Refunded) is derived, never stored. |
| `CustomerCreditEntry` | The customer's credit ledger: overpayment kept (+), used on an order (−), refunded (−), from a cancelled order (+), reversal | **Append-only** (same customer re-link exception). The balance is the sum and can never go below zero. |
| `AccountTransfer` | Money moved between the business's own accounts (`TRF-xxxxx`) | **Append-only**, reversed by a mirror transfer. Never a sale, refund or expense. |

**Rules** (all in `modules/payments/ledger.ts`, the single writer of money rows):
- **Allocations can't exceed what's due.** Order rows are locked (in id order) before money is applied, so two payments arriving together can't both fill the same balance.
- **Leftover money must be explicit.** Whatever isn't applied to orders must be kept as the customer's credit (`excessToCredit`), which needs a customer. Walk-in money can't be left unapplied.
- **POS split tender.** Each leg (cash, PhonePe, …) is its own payment, applied to the sale in order.
  - Walk-ins must pay in full.
  - A known customer may pay part (the rest is due, from their credit days) or overpay into credit when that's ticked.
  - Amounts are what was kept; change isn't recorded.
- **Credit** is spent on an order (a credit entry plus a credit-sourced allocation) or refunded as an `OUT` payment (admin). The customer row is locked while credit is spent.
- **Voids** mirror the payment, its allocations and its credit entries. They're refused when that would leave an order paid below zero or above its total, or credit that has already been spent.
- **Cancelling a paid order** requires a settlement: refund it (`OUT` payment from an account) or move it into the customer's credit. Walk-ins can only be refunded.
- **Gateway fees** default to the account's fee % and can be overridden. They feed contribution profit (phase 13).

**Collections.** Collections show received, refunded, fees and net by method and by account, plus business vs personal accounts and amounts by sales channel ("held as credit" for money not applied to orders).
- A void is netted against what it undoes.
- Transfers appear per account but are never "received".

**Outstanding.** Outstanding lists every confirmed order with a balance. It's aged from the order date (0–30, 31–60, 60+), flagged overdue past its due date, and splits **receivable** (fulfilled) from **open orders** (not yet handed over or dispatched, so not yet a receivable).

## Phase 8: pre-orders and advances

No new tables: a pre-order is a `SalesOrder` with `type = PRE_ORDER`, so its advance and balance are just payments on one order, and revenue is booked once, at fulfilment.

**Flow.** Create a pre-order and confirm it (no stock is touched), then take an advance.
- When the goods arrive (a purchase is received), **allocate**. That reserves every line at once, all or nothing, under the same per-variant lock as any reservation. Physical stock is still unchanged; only "available" drops.
- Take the balance, then hand over or dispatch. That is when stock leaves and the sale counts as revenue.
- Packing and fulfilment are refused until the pre-order is allocated (`NOT_ALLOCATED`).

**Queue.** Open pre-orders are served oldest first against free stock. A pre-order is *Ready* when stock covers all of it after older ready pre-orders take theirs. An older one that can't be covered doesn't block a smaller younger one.
- "Allocate all ready" (and per item) allocates each ready pre-order in its own transaction, so one that loses a race is skipped, not fatal.

**Release.** An admin can release an allocation (e.g. to serve a more urgent customer). The pre-order goes back to waiting.
- Reservations are therefore a history per order line: released rows stay, with `releaseReason` `FULFILLED`, `CANCELLED` or `DEALLOCATED`.
- At most one may be active per line. Prisma can't express that partial unique index without schema drift, so the reservation trigger enforces it on insert.

**Advances** are payments allocated to orders not yet handed over or dispatched (pre-orders and other open orders). They're a liability: shown under Payments → Advances and on the dashboard, never in sales. Cancelling a pre-order with an advance requires a refund or a move into the customer's credit (phase 7).

**Expected arrival** can be changed until fulfilment (timeline: "Expected date changed"). Pre-orders past it are flagged as late. The receipt prints as an **Order confirmation** listing the advance and balance due until the goods are handed over.

## Phase 9: returns and refunds

| Model | Purpose | Key rules |
|---|---|---|
| `SalesReturn` | Goods back from a fulfilled order (`RET-xxxxx`): location restocked, date, reason, GST-inclusive value reversed (lines + any shipping refund), taxable and GST reversed, refund method (`NONE` / `REFUND` / `CREDIT`) and amount, links to the refund payment or credit entry and the `SALE_RETURN` stock document | **Append-only.** Only fulfilled orders take returns; before that, cancel. The order row is locked, so two returns can't both take the last units. `refundMethod = NONE` exactly when nothing is refunded. |
| `SalesReturnLine` | Per order line: quantity, **condition** (resellable / damaged / write-off), amount, taxable value, GST, cost of the returned units with a known cost, unknown-cost units | **Append-only.** Never more than sold − already returned. |

**Amounts.** Each line's share is proportional to its units, and returning the last units takes whatever is left, so a line returned in several goes reverses exactly what it sold for. Shipping refunds are split into taxable value and GST in the proportion they were charged, and can't exceed what's left.

**Stock and cost.**
- **Resellable** units go back to SELLABLE and **damaged** units to DAMAGED. Both come back at the cost they left at (known-cost units first), so the weighted average isn't disturbed.
- **Written-off** units don't come back, and their cost stays as a loss (profit shows it).

**Money.** An order's **net value** = grand total − returns. It drives due, payment status, outstanding, allocation limits and the void checks.
- A return gives money back only when the customer has paid more than the new net value, and only that difference.
- That money goes as a refund payment from an account (admin) or into the customer's credit (`RETURN` entry).
- An unpaid credit sale simply owes less.

**Exchanges.** Customer credit can pay (part of) a POS sale (`creditAmount`). It's applied before the money tender, so a return to credit plus a new sale is one checkout.

**Reports.** The sales summary nets returns dated in the period from net sales and GST. Their cost comes back unless written off. Lifetime value is net of returns.

## Phase 10: courier and shipping

| Model | Purpose | Key rules |
|---|---|---|
| `CourierPartner` | A courier with an optional tracking-link template (`{awb}` marks where the tracking number goes) | Managed in Settings → Couriers (admin). The CRM only links to the courier's page; it never polls it. |
| `Shipment` | Getting a delivery order to the customer (`SHP-xxxxx`): courier, status, courier cost, packed/dispatched/delivered times | One open shipment per order (the order row is the lock). A cancelled or returned one can be followed by a new one. The courier can't change after dispatch; the cost can be updated when the bill arrives. |
| `ShipmentPackage` | One parcel with its AWB (upper-case) and optional weight | AWBs are **unique**, so the same tracking number can't be booked twice. A trigger locks parcels once the shipment has gone out. |
| `ShipmentEvent` | Status history with note and user | **Append-only.** |

**Status flow** (entered by hand from the courier's tracking): to pack → packed → dispatched → in transit → out for delivery → delivered, with RTO → back with us, and cancel before dispatch. Moves follow `SHIPMENT_TRANSITIONS`, so a step can be skipped forward but never taken backwards.

**The shipment drives the order** in the same transaction, through the sales engine:
- **Packed** packs the order.
- **Dispatched** needs a courier and at least one AWB. It deducts stock and fixes cost exactly once, and revenue counts from here.
- **Delivered** delivers the order.
- A shipment can be created for an order that was already dispatched by hand; it then starts as dispatched.
- While a delivery order has an open shipment, the order's own pack, dispatch and deliver buttons hide, so there is one path.

**RTO.** A parcel coming back is recorded as RTO, then "back with us", both noted on the order timeline. The goods go back into stock, with any refund, through a return on the order (phase 9).

**Cost vs charged.** Each shipment shows what the courier charges us next to the shipping charged to the customer (less any shipping refunded). It feeds contribution profit in phase 13.
