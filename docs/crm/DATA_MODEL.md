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
