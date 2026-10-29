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
  | "receiving_account.updated";

export type AuditEntity = "User" | "BusinessProfile" | "Location" | "ReceivingAccount";

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
      metadata: toJsonSafe({ ...entry.metadata, ip: ctx.ip, userAgent: ctx.userAgent, requestId: ctx.requestId }, SECRET_KEYS) as Prisma.InputJsonObject,
    },
  });
}

function jsonOrUndefined(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return toJsonSafe(value, SECRET_KEYS) as Prisma.InputJsonValue;
}
