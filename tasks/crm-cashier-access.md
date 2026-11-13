# CRM — Minimum access for Cashier and Ops, cashier sees only their own sales

Goal: give Cashier and Ops only the permissions their daily work needs. A cashier sees only the sales they rang up themselves.

## Decisions (agreed 2026-11-13)
- "Their own sale" means the CRM login that created it (`SalesOrder.createdById`). Salespeople don't log in, so they can't be the link. **Each cashier needs their own login.** A shared till login shares its sales.
- Another cashier can still find any **open counter order waiting for pickup** (counter, confirmed or packed, not handed over), take the balance and hand it over. Once it's handed over, it's visible only to its creator again.
- Admin and Ops see every sale. Ops packs and ships everyone's orders.
- New permission `sales.view.all` (Admin, Ops). `sales.view` without it = own sales + open counter pickups.
- The cashier keeps store credit (`payments.view`), full phone numbers (`customers.contact.reveal`) and stock levels (`inventory.view`).
- `products.view` stays for both roles. The stock-move and stock-count variant pickers load product details, and product endpoints never expose cost.

## Tasks
### Permissions (packages/crm-schema)
- [x] Cashier: `products.view`, `inventory.view`, `sales.view`, `sales.create`, `payments.view`, `payments.record`, `customers.view`, `customers.manage`, `customers.contact.reveal`, `cash.close`. Dropped: `dashboard.view`, `reports.view`
- [x] Ops: `products.view`, `inventory.view`, `inventory.move`, `purchases.view`, `purchases.receive`, `sales.view`, `sales.view.all`, `shipping.manage`, `stockcount.perform`. Dropped: `dashboard.view`, `customers.view`, `customers.contact.reveal`
- [x] Add `sales.view.all` (Admin, Ops)

### API (apps/crm-api)
- [x] `modules/sales/scope.ts`: `salesScope(req)`, `scopeWhere`, `inScope`, `orderInScope` middleware
- [x] Sales list + CSV export, sales summary: scoped
- [x] Every `/sales/:id` route: someone else's order returns 404
- [x] Pre-orders list and summary: scoped. The stock queue is still worked out over all open pre-orders
- [x] Returns list/detail: scoped by the order's creator
- [x] Shipment reads now need `shipping.manage` or `sales.view.all` (cashiers never used them; the order page carries its own shipment)
- [x] Vitest `sales-scope.test.ts`: own list/detail, summary counts own only, cross-cashier pickup + handover, drafts/delivery hidden from actions, returns scoped, shipments 403

### Web (apps/crm-web)
- [x] Home page: users without `dashboard.view` go to their first allowed page (Cashier → POS, Ops → Sales Orders)
- [x] Phone bottom tabs filtered by permission
- [x] Sales Orders and Pre-orders subtitles say "Sales you made, plus counter orders waiting for pickup" for cashiers

### Docs
- [x] USER_MANUAL.md: roles table, "a cashier sees only their own sales", Dashboard/Reports/Customers menu notes

### Checks
- [x] crm-api tsc, Vitest **221/221**, crm-web check-types + lint (0 warnings)

## Review (2026-11-13)
- Existing tests that assumed the old roles were updated: cashier/ops dashboard and reports now 403, ops customer list 403, and the cashier-can't-dispatch and cashier-sees-returns tests use the cashier's own sale.
- **Bug found and fixed in the staged commission change:** creating a salesperson returned 500. `$queryRaw` can't read the `void` that `pg_advisory_xact_lock` returns, so it's now `$executeRaw`. This went unnoticed last time because Docker was down. With the fix, `commission.test.ts` passes 9/9, which also checks the gross-profit figures.
- Not scoped (by design): Payments pages and Cash Closing still show all payments, because the cashier counts the whole drawer. Customer pages show lifetime totals across all cashiers. Ask if Payments should be scoped too.
- Not done: a browser click-through.
