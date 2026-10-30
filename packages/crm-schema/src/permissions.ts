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
  "purchases.view",
  "purchases.manage",
  "purchases.receive",
  "sales.view",
  "sales.create",
  "sales.manage",
  "payments.view",
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
  "expenses.manage",
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
    "dashboard.view",
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
    "reports.view",
  ],
  OPS: [
    "dashboard.view",
    "products.view",
    "inventory.view",
    "inventory.move",
    "purchases.view",
    "purchases.receive",
    "sales.view",
    "customers.view",
    "customers.contact.reveal",
    "shipping.manage",
    "stockcount.perform",
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
