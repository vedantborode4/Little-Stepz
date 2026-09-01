import { prisma } from "@repo/db/client";
import { Request } from "express";

export type AuditAction =
  | "PAYMENT_INITIATED"
  | "PAYMENT_SUCCESS"
  | "PAYMENT_FAILED"
  | "PAYMENT_COD_CREATED"
  | "REFUND_INITIATED"
  | "REFUND_SUCCESS"
  | "REFUND_FAILED"
  | "COMMISSION_CREATED"
  | "COMMISSION_REVERSED"
  | "COMMISSION_APPROVED"
  | "COMMISSION_PAID"
  | "RETURN_REQUESTED"
  | "RETURN_APPROVED"
  | "RETURN_REJECTED"
  | "ORDER_CANCELLED"
  | "WEBHOOK_PROCESSED"
  | "WEBHOOK_DUPLICATE"
  | "SHIPMENT_CREATED"
  | "SHIPMENT_CANCELLED"
  | "SHIPMENT_FAILED"
  | "ORDER_STATUS_UPDATED"
  | "AFFILIATE_APPLIED"
  | "AFFILIATE_APPROVED"
  | "AFFILIATE_REJECTED"
  | "AFFILIATE_UPDATED"
  | "AFFILIATE_WITHDRAWAL_REQUESTED"
  | "AFFILIATE_WITHDRAWAL_PAID"
  | "AFFILIATE_WITHDRAWAL_REJECTED"
  | "REFERRAL_CLICK_RECORDED"
  | "REFERRAL_CONVERTED"
  | "NOTIFICATION_BROADCAST"
  | "CART_ITEM_ADDED"
  // Partial payment (20% deposit / balance at delivery). The money on these orders moves
  // in two legs and through three possible channels, so every transition is auditable —
  // the audit row is what a reconciliation or a chargeback dispute is settled from.
  | "DEPOSIT_CAPTURED"
  | "DEPOSIT_FORFEITED"
  | "BALANCE_LINK_CLOSED_AT_DISPATCH"
  | "BALANCE_PAID_ONLINE"
  | "BALANCE_MARKED_PAID"
  | "BALANCE_COLLECTED_COD"
  | "BALANCE_PAYMENT_FAILED"
  | "BALANCE_DOUBLE_CAPTURE"
  | "BALANCE_FORCED_ONLINE"
  | "COD_DOUBLE_COLLECTION_RISK"
  | "COD_REMITTANCE_MISMATCH"
  | "MANUAL_REFUND_OWED"
  | "MANUAL_REFUND_SETTLED"
  | "REFUND_SKIPPED_BELOW_MINIMUM"
  | "ORDER_SETTLED"
  | "SETTLEMENT_FAILED"
  /// Resets the auto-ship failure count so a recoverable problem (corrected address,
  /// balance moved online, pincode that regained COD) can be retried. Without it the
  /// permanent SHIPMENT_FAILED trail strands a paid order after three attempts.
  | "SHIPMENT_RETRY_CLEARED";

export type AuditEntity =
  | "Payment"
  | "Order"
  | "Commission"
  | "Return"
  | "Shipment"
  | "WebhookEvent"
  | "Affiliate"
  | "AffiliateWithdrawal"
  | "Notification"
  | "CartItem";

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
  return value; 
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
    // Never let audit log failure crash the request
    console.error("[AuditLog] Failed to write audit log:", err);
  }
}


export async function createAuditLogInTx(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  params: CreateAuditLogParams
): Promise<void> {
  const metadata: Record<string, unknown> = params.metadata ?? {};

  if (params.req) {
    metadata.ip = params.req.ip ?? params.req.socket?.remoteAddress;
    metadata.userAgent = params.req.get("User-Agent");
    metadata.requestId = params.req.get("X-Request-Id");
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