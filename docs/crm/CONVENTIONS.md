# CRM engineering conventions

Applies to `apps/crm-api`, `apps/crm-web`, `packages/crm-db` and `packages/crm-schema`. Every phase review checks against this list.

## Layout

```
packages/crm-schema   Zod request schemas, enums + labels, permission matrix, response DTO types
packages/crm-db       Prisma schema, migrations, generated client (own output dir)
apps/crm-api/src
  config/env.ts       Zod-validated environment — the only place process.env is read
  core/               cross-cutting building blocks (see below)
  modules/<domain>/   <domain>.routes.ts → .controller.ts → .service.ts
  routes.ts           mounts modules; everything after /auth requires a session
apps/crm-web
  app/                routes only — thin pages that compose feature components
  features/<domain>/  api.ts (query keys + hooks) and the domain's components
  components/ui/      shared kit: DataTable, Modal, ConfirmDialog, Form, Display, Toolbar, Tabs
  components/shell/   CrmShell, Sidebar, RequirePermission, ThemeToggle
  lib/                api-client, api-error, format, download, nav, use-list-state, use-api-form
```

## Rules

**Flow.** routes → middleware (authenticate, requirePermission) → controller → service. Controllers parse input with a `@repo/crm-schema` schema, call one service function, and respond with `sendData`. Services own business rules and all Prisma access. Express 5 forwards async errors on its own, so there's no `asyncHandler`.

**Contracts.** Request schemas, enums and DTO types live in `@repo/crm-schema`, never ad hoc. API mappers (`toXDto`) are typed against the DTO, so a contract change breaks the build on both sides. `core/contracts.ts` fails the build if a Prisma enum and its crm-schema mirror drift apart.

**Errors.** Throw `ApiError(status, CODE, message, details?)`. Codes are stable `SCREAMING_SNAKE`. Every error response has the same shape: `{ error: { code, message, details } }`. Zod failures become `VALIDATION_FAILED` with `details.fieldErrors`, and `useApiForm` puts those messages back on the matching inputs.

**Transactions and audit.** Every write that changes business state:
- runs inside `withTransaction` (which retries on write conflicts), and
- calls `recordAudit(tx, ctx, { action, entity, entityId, before, after })` in the same transaction.

Services take a `RequestContext`, not an Express `req`, so scripts and jobs can call them too.

**Append-only data.** Ledger tables (`AuditLog` now; stock movements and payments later) are protected by the `crm_reject_mutation()` trigger. Corrections are new reversing rows.

**Money.**
- The API sends and receives money as decimal strings (the `money` schema).
- Columns are `Decimal(14,2)`, with `Decimal(18,6)` for unit costs and FX rates.
- Arithmetic uses `Prisma.Decimal` / `decimal.js` only.
- The web app converts to `Number` only for display (`formatMoney`), never for maths.

**Lists.** All list endpoints use `listQuery` (page, limit, q, sort, format). Sorting goes through a per-endpoint whitelist (`buildOrderBy`). Exports reuse the same query, so CSV/Excel always matches the filtered view, capped at `EXPORT_MAX_ROWS`. `sendExport` neutralises spreadsheet formulas.

**Permissions.** The API enforces them (`requirePermission`). The web hides what a role can't use (`useCan`, `RequirePermission`), but never relies on hiding alone.

**UI.**
- Use the shared kit. Tokens come from `globals.css` (copied from the website admin), so never hard-code hex values in components.
- Every destructive action goes through `ConfirmDialog`.
- Every table has a `mobileCard`.
- Page titles go through `PageHeader`.

**Formatting.** Each CRM package has its own `.prettierrc.json`: the web app has no semicolons (matching the website), the API and packages use semicolons, and lines are 140 characters. Run `npx prettier --write` on the files you touch.

**Comments.** Explain *why* (an accounting rule, a race, a security decision), never *what*.

**Tests.** `apps/crm-api/test/*.test.ts` (Vitest + supertest) runs against `<db>_test`, brought up to date with `prisma migrate deploy`. Tests create uniquely named data and never assume an empty database. Each phase adds tests for its rules.
