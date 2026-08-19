import {
  PrismaClient,
  Prisma,
  Role,
  CouponType,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  AffiliateStatus,
  CommissionStatus,
  CommissionType,
  WithdrawalStatus,
  WebhookStatus,
  ReturnStatus,
  ShipmentStatus,
  BannerPosition,
  PreOrderStatus,
  DevicePlatform,
  NotificationCategory,
  NotificationType,
} from "@prisma/client";

/**
 * Interactive transactions get an explicit budget instead of Prisma's 5s default.
 *
 * The database is remote (Neon), so a transaction doing several round-trips —
 * an order-cancellation unwind, a password reset, a checkout — can exceed 5s on a
 * slow moment and abort mid-way, rolling back work that had already succeeded.
 * Observed in practice: a cancellation left stock un-restored, and a password reset
 * returned 500 after already consuming its single-use token.
 *
 * ~60 call sites relied on the default; setting it here fixes them together.
 * Per-call `{ timeout }` options still override this.
 */
export const prisma = new PrismaClient({
  transactionOptions: {
    maxWait: 5_000,
    timeout: 20_000,
  },
});

export {
  Prisma,
  Role,
  CouponType,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  AffiliateStatus,
  CommissionStatus,
  CommissionType,
  WithdrawalStatus,
  WebhookStatus,
  ReturnStatus,
  ShipmentStatus,
  BannerPosition,
  PreOrderStatus,
  DevicePlatform,
  NotificationCategory,
  NotificationType,
};
