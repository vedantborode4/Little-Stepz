import {
  PrismaClient,
  Role,
  CouponType,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  AffiliateStatus,
  CommissionStatus,
  WebhookStatus,
  ReturnStatus,
  ShipmentStatus,
} from "@prisma/client";

export const prisma = new PrismaClient();

export {
  Role,
  CouponType,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  AffiliateStatus,
  CommissionStatus,
  WebhookStatus,
  ReturnStatus,
  ShipmentStatus,
};
