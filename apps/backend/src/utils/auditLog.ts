import { prisma } from "@repo/db/client";
import { Request } from "express";

export type AuditAction =
  | "PAYMENT_INITIATED"
  | "PAYMENT_SUCCESS"
  | "PAYMENT_FAILED"
  | "PAYMENT_COD_CREATED"
  | "REFUND_INITIATED"
  | "REFUND_SUCCESS"
  | "COMMISSION_CREATED"
  | "COMMISSION_REVERSED"
  | "RETURN_REQUESTED"
  | "RETURN_APPROVED"
  | "RETURN_REJECTED"
  | "ORDER_CANCELLED"
  | "WEBHOOK_PROCESSED"
  | "WEBHOOK_DUPLICATE"
  | "SHIPMENT_CREATED"
  | "ORDER_STATUS_UPDATED";

export type AuditEntity =
  | "Payment"
  | "Order"
  | "Commission"
  | "Return"
  | "Shipment"
  | "WebhookEvent";

export interface CreateAuditLogParams {
  userId?: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  req?: Request; // For IP + user-agent capture
}

function asJsonValue<T>(value: T | undefined): any {
  if (value === undefined) return undefined;
  return value; // direct reference – fast and usually fine for audit logs
  // Alternative (more defensive): return JSON.parse(JSON.stringify(value));
}


export async function createAuditLog(params: CreateAuditLogParams): Promise<void> {
  const metadata: Record<string, unknown> = params.metadata ?? {};

  if (params.req) {
    metadata.ip = params.req.ip ?? params.req.socket?.remoteAddress;
    metadata.userAgent = params.req.get("User-Agent");
    metadata.requestId = params.req.get("X-Request-Id") ?? undefined;
  }

  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        oldValue: asJsonValue(params.oldValue),
        newValue: asJsonValue(params.newValue),
        metadata: asJsonValue(metadata),
      },
    });
  } catch (err) {
    // Audit logging must never crash the main flow
    console.error("[AuditLog] Failed to create audit log:", err);
  }
}


export async function createAuditLogInTx(
  tx: any, // Using `any` to avoid importing Prisma – works fine in practice
  params: CreateAuditLogParams
): Promise<void> {
  const metadata: Record<string, unknown> = params.metadata ?? {};

  if (params.req) {
    metadata.ip = params.req.ip ?? params.req.socket?.remoteAddress;
    metadata.userAgent = params.req.get("User-Agent");
    metadata.requestId = params.req.get("X-Request-Id") ?? undefined;
  }

  await tx.auditLog.create({
    data: {
      userId: params.userId ?? null,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      oldValue: asJsonValue(params.oldValue),
      newValue: asJsonValue(params.newValue),
      metadata: asJsonValue(metadata),
    },
  });
}