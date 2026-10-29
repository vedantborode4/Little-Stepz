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
