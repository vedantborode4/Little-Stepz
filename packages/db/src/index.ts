import { PrismaClient, Role, CouponType, OrderStatus, PaymentStatus, AffiliateStatus, CommissionStatus } from "@prisma/client";

export const prisma = new PrismaClient();
export { Role, CouponType, OrderStatus, PaymentStatus, AffiliateStatus, CommissionStatus };