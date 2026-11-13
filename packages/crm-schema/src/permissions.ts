import type { Role } from "./enums";

/**
 * The full permission vocabulary for every CRM module. Defined up front so the
 * role model is reviewable in one place; modules adopt their keys as they ship.
 * The API is the enforcement point — clients only use this to hide what a role
 * cannot do.
 */
export const PERMISSIONS = [
  "dashboard.view",
  "products.view",
  "products.manage",
  "costs.view",
  "inventory.view",
  "inventory.move",
  /** Opening stock, write-offs, adjustments and reversals — corrections that change physical stock. */
  "inventory.adjust",
  /** Setting an item's landed cost after its stock is in — revalues stock and re-costs the sales it covers. */
  "inventory.cost",
  "purchases.view",
  "purchases.manage",
  "purchases.receive",
  /** Money paid to and owed by suppliers: advances, goods received against them, refunds and credit. */
  "suppliers.ledger",
  "sales.view",
  /** Every sale. Without it, `sales.view` shows only the user's own sales plus open counter orders waiting for pickup. */
  "sales.view.all",
  "sales.create",
  "sales.manage",
  "payments.view",
  /** Every payment. Without it, `payments.view` shows only payments the user recorded, and only their own orders' balances. */
  "payments.view.all",
  "payments.record",
  "payments.refund",
  /** Moving money between receiving accounts (e.g. cash to bank). */
  "payments.transfer",
  "customers.view",
  "customers.manage",
  "customers.contact.reveal",
  /** Folding a duplicate customer into another — history moves and can't be split again. */
  "customers.merge",
  /** Exporting customer lists with full phone numbers and emails. */
  "customers.export",
  "shipping.manage",
  "cash.close",
  /** Unlocking a closed cash day to correct it. */
  "cash.reopen",
  "expenses.manage",
  /** Salespeople, their commission rates, commission earned and payouts. */
  "commission.manage",
  /** "My commission": the commission of the salesperson linked to the user's login. */
  "commission.view.own",
  "stockcount.perform",
  "stockcount.approve",
  "reports.view",
  "reports.financial",
  "import.manage",
  "settings.manage",
  "users.manage",
  "audit.view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: PERMISSIONS,
  CASHIER: [
    "products.view",
    "inventory.view",
    "sales.view",
    "sales.create",
    "payments.view",
    "payments.record",
    "customers.view",
    "customers.manage",
    "customers.contact.reveal",
    "cash.close",
    "commission.view.own",
  ],
  OPS: [
    "products.view",
    "inventory.view",
    "inventory.move",
    "purchases.view",
    "purchases.receive",
    "sales.view",
    "sales.view.all",
    "shipping.manage",
    "stockcount.perform",
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
