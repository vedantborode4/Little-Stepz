-- CreateEnum
CREATE TYPE "PreOrderStatus" AS ENUM ('PENDING_BOOKING', 'BOOKED', 'AWAITING_BALANCE', 'COMPLETED', 'EXPIRED', 'CANCELLED', 'REFUNDED');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "bookingAmount" DECIMAL(12,2),
ADD COLUMN     "preOrderCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "preOrderEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "preOrderLimit" INTEGER,
ADD COLUMN     "preOrderNote" TEXT;

-- CreateTable
CREATE TABLE "PreOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "addressId" TEXT,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "bookingAmount" DECIMAL(12,2) NOT NULL,
    "shippingCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "balanceAmount" DECIMAL(12,2) NOT NULL,
    "status" "PreOrderStatus" NOT NULL DEFAULT 'PENDING_BOOKING',
    "bookingRazorpayOrderId" TEXT,
    "bookingRazorpayPaymentId" TEXT,
    "bookingPaidAt" TIMESTAMP(3),
    "balanceToken" TEXT,
    "balanceRazorpayOrderId" TEXT,
    "balanceRazorpayPaymentId" TEXT,
    "balancePaidAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "balanceDueAt" TIMESTAMP(3),
    "refundId" TEXT,
    "refundedAt" TIMESTAMP(3),
    "orderId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PreOrder_bookingRazorpayOrderId_key" ON "PreOrder"("bookingRazorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "PreOrder_bookingRazorpayPaymentId_key" ON "PreOrder"("bookingRazorpayPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "PreOrder_balanceToken_key" ON "PreOrder"("balanceToken");

-- CreateIndex
CREATE UNIQUE INDEX "PreOrder_balanceRazorpayOrderId_key" ON "PreOrder"("balanceRazorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "PreOrder_balanceRazorpayPaymentId_key" ON "PreOrder"("balanceRazorpayPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "PreOrder_orderId_key" ON "PreOrder"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "PreOrder_idempotencyKey_key" ON "PreOrder"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PreOrder_userId_idx" ON "PreOrder"("userId");

-- CreateIndex
CREATE INDEX "PreOrder_productId_idx" ON "PreOrder"("productId");

-- CreateIndex
CREATE INDEX "PreOrder_status_idx" ON "PreOrder"("status");

-- AddForeignKey
ALTER TABLE "PreOrder" ADD CONSTRAINT "PreOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreOrder" ADD CONSTRAINT "PreOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreOrder" ADD CONSTRAINT "PreOrder_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreOrder" ADD CONSTRAINT "PreOrder_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreOrder" ADD CONSTRAINT "PreOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
