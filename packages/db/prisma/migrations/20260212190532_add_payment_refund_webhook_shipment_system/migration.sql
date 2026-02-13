/*
  Warnings:

  - You are about to drop the column `paymentData` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `transactionId` on the `Payment` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[razorpayOrderId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[razorpayPaymentId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[paymentIdempotencyKey]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('ONLINE', 'COD');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "OrderStatus" ADD VALUE 'OUT_FOR_DELIVERY';
ALTER TYPE "OrderStatus" ADD VALUE 'RETURN_REQUESTED';
ALTER TYPE "OrderStatus" ADD VALUE 'RETURN_APPROVED';
ALTER TYPE "OrderStatus" ADD VALUE 'RETURN_REJECTED';
ALTER TYPE "OrderStatus" ADD VALUE 'RETURNED';
ALTER TYPE "OrderStatus" ADD VALUE 'REFUND_INITIATED';
ALTER TYPE "OrderStatus" ADD VALUE 'REFUNDED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentStatus" ADD VALUE 'INITIATED';
ALTER TYPE "PaymentStatus" ADD VALUE 'REFUND_INITIATED';
ALTER TYPE "PaymentStatus" ADD VALUE 'REFUNDED';
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_REFUNDED';

-- DropIndex
DROP INDEX "Payment_gateway_transactionId_idx";

-- AlterTable
ALTER TABLE "Commission" ADD COLUMN     "reversalReason" TEXT,
ADD COLUMN     "reversedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "adminNote" TEXT,
ADD COLUMN     "awbCode" TEXT,
ADD COLUMN     "customerNote" TEXT,
ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'ONLINE',
ADD COLUMN     "shiprocketOrderId" TEXT,
ADD COLUMN     "shiprocketShipmentId" TEXT,
ADD COLUMN     "trackingUrl" TEXT;

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "paymentData",
DROP COLUMN "transactionId",
ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "codCollectedAt" TIMESTAMP(3),
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'INR',
ADD COLUMN     "gatewayResponse" JSONB,
ADD COLUMN     "method" "PaymentMethod" NOT NULL DEFAULT 'ONLINE',
ADD COLUMN     "paymentIdempotencyKey" TEXT,
ADD COLUMN     "razorpayOrderId" TEXT,
ADD COLUMN     "razorpayPaymentId" TEXT,
ADD COLUMN     "razorpaySignature" TEXT,
ADD COLUMN     "refundAmount" DECIMAL(65,30),
ADD COLUMN     "refundId" TEXT,
ADD COLUMN     "refundReason" TEXT,
ADD COLUMN     "refundedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookStatus" NOT NULL DEFAULT 'PENDING',
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Return" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" "ReturnStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "refundAmount" DECIMAL(65,30),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Return_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "shiprocketOrderId" TEXT,
    "shiprocketShipmentId" TEXT,
    "awbCode" TEXT,
    "courierName" TEXT,
    "trackingUrl" TEXT,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
    "estimatedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "trackingData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebhookEvent_provider_eventType_idx" ON "WebhookEvent"("provider", "eventType");

-- CreateIndex
CREATE INDEX "WebhookEvent_status_idx" ON "WebhookEvent"("status");

-- CreateIndex
CREATE INDEX "WebhookEvent_createdAt_idx" ON "WebhookEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_eventId_key" ON "WebhookEvent"("provider", "eventId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Return_orderId_key" ON "Return"("orderId");

-- CreateIndex
CREATE INDEX "Return_userId_idx" ON "Return"("userId");

-- CreateIndex
CREATE INDEX "Return_status_idx" ON "Return"("status");

-- CreateIndex
CREATE INDEX "Shipment_orderId_idx" ON "Shipment"("orderId");

-- CreateIndex
CREATE INDEX "Shipment_awbCode_idx" ON "Shipment"("awbCode");

-- CreateIndex
CREATE INDEX "Shipment_status_idx" ON "Shipment"("status");

-- CreateIndex
CREATE INDEX "Commission_orderId_idx" ON "Commission"("orderId");

-- CreateIndex
CREATE INDEX "Order_paymentMethod_idx" ON "Order"("paymentMethod");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_razorpayOrderId_key" ON "Payment"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_razorpayPaymentId_key" ON "Payment"("razorpayPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_paymentIdempotencyKey_key" ON "Payment"("paymentIdempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_gateway_razorpayOrderId_idx" ON "Payment"("gateway", "razorpayOrderId");

-- CreateIndex
CREATE INDEX "Payment_razorpayPaymentId_idx" ON "Payment"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_paymentIdempotencyKey_idx" ON "Payment"("paymentIdempotencyKey");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
