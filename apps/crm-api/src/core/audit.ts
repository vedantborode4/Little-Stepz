import type { Prisma, Tx } from "@repo/crm-db/client";
import type { RequestContext } from "./http";
import { toJsonSafe } from "./json";

/** Grows with each module; keep names `entity.verb` in past tense. */
export type AuditAction =
  | "auth.login"
  | "auth.login_failed"
  | "auth.logout"
  | "auth.password_changed"
  | "auth.refresh_reuse_detected"
  | "user.created"
  | "user.updated"
  | "user.password_reset"
  | "business_profile.updated"
  | "location.created"
  | "location.updated"
  | "receiving_account.created"
  | "receiving_account.updated"
  | "category.created"
  | "category.updated"
  | "brand.created"
  | "brand.updated"
  | "supplier.created"
  | "supplier.updated"
  | "product.created"
  | "product.updated"
  | "variant.created"
  | "variant.updated"
  | "variant.tiers_updated"
  | "variant.mapping_updated"
  | "price.bulk_updated"
  | "stock.posted"
  | "stock.reversed"
  | "purchase.created"
  | "purchase.updated"
  | "purchase.cancelled"
  | "purchase.received"
  | "purchase.cost_adjusted"
  | "purchase.returned"
  | "customer.created"
  | "customer.updated"
  | "customer.contact_revealed"
  | "customer.contacts_exported"
  | "customer.merged"
  | "customer.merged_in"
  | "customer.price_set"
  | "customer.price_removed"
  | "sale.created"
  | "sale.updated"
  | "sale.confirmed"
  | "sale.packed"
  | "sale.fulfilled"
  | "sale.completed"
  | "sale.delivered"
  | "sale.cancelled"
  | "sale.allocated"
  | "sale.deallocated"
  | "sale.rescheduled"
  | "payment.received"
  | "payment.voided"
  | "payment.settled_on_cancel"
  | "credit.applied"
  | "credit.refunded"
  | "transfer.created"
  | "transfer.reversed"
  | "return.created"
  | "courier.created"
  | "courier.updated"
  | "shipment.created"
  | "shipment.updated"
  | "shipment.status_changed"
  | "expense_category.created"
  | "expense_category.updated"
  | "expense.created"
  | "expense.voided"
  | "cash.opened"
  | "cash.closed"
  | "cash.reopened"
  | "stockcount.created"
  | "stockcount.updated"
  | "stockcount.submitted"
  | "stockcount.sent_back"
  | "stockcount.approved"
  | "stockcount.cancelled"
  | "stockcount.reversed"
  | "import.uploaded"
  | "import.checked"
  | "import.approved"
  | "import.rolled_back"
  | "import.cancelled"
  | "sync.dry_run"
  | "sync.linked";

export type AuditEntity =
  | "User"
  | "BusinessProfile"
  | "Location"
  | "ReceivingAccount"
  | "Category"
  | "Brand"
  | "Supplier"
  | "Product"
  | "Variant"
  | "PriceBatch"
  | "StockDocument"
  | "PurchaseShipment"
  | "Customer"
  | "SalesOrder"
  | "Payment"
  | "AccountTransfer"
  | "SalesReturn"
  | "CourierPartner"
  | "Shipment"
  | "ExpenseCategory"
  | "Expense"
  | "CashSession"
  | "StockCount"
  | "ImportBatch"
  | "SyncRun";

export interface AuditEntry {
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}

const SECRET_KEYS = new Set(["passwordHash", "password", "tokenHash"]);

/**
 * Written inside the caller's transaction, so a change and its audit row commit
 * or roll back together. AuditLog is append-only at the database level.
 */
export async function recordAudit(tx: Tx, ctx: RequestContext, entry: AuditEntry): Promise<void> {
  await tx.auditLog.create({
    data: {
      userId: ctx.userId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      before: jsonOrUndefined(entry.before),
      after: jsonOrUndefined(entry.after),
      metadata: toJsonSafe(
        { ...entry.metadata, ip: ctx.ip, userAgent: ctx.userAgent, requestId: ctx.requestId },
        SECRET_KEYS,
      ) as Prisma.InputJsonObject,
    },
  });
}

function jsonOrUndefined(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return toJsonSafe(value, SECRET_KEYS) as Prisma.InputJsonValue;
}
