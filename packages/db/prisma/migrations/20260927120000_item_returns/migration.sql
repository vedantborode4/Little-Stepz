-- Item-level returns: return some items, or some units, from a delivered order.
--
-- Additive except one relaxation: Return.orderId loses its UNIQUE so an order can carry
-- several return requests. That UNIQUE was the only guard against a double-submitted
-- legacy return, so DEPLOY THE BACKEND FIRST: createReturnRequestService now takes a row
-- lock on the Order, and admin order reads pick the PENDING return rather than returns[0].
-- Running this migration under the previous backend reopens the duplicate-return race.
-- Constant-default ADD COLUMNs are
-- catalog-only on PG11+ (no table rewrite). ALTER TYPE ... ADD VALUE needs PG12+ inside
-- a transaction; Neon runs PG15+.
--
-- Rollback note: once rows use the new ReturnStatus values, an older Prisma client throws
-- when reading them. Roll back by turning ITEM_RETURNS_ENABLED off, not by reverting code.

-- CreateEnum
CREATE TYPE "ReturnRefundChannel" AS ENUM ('RAZORPAY_PRIMARY', 'RAZORPAY_BALANCE', 'MANUAL');

-- CreateEnum
CREATE TYPE "ReturnRefundStatus" AS ENUM ('PENDING', 'INITIATED', 'PROCESSED', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReturnStatus" ADD VALUE 'PICKED_UP';
ALTER TYPE "ReturnStatus" ADD VALUE 'RECEIVED';
ALTER TYPE "ReturnStatus" ADD VALUE 'INSPECTION_FAILED';
ALTER TYPE "ReturnStatus" ADD VALUE 'CANCELLED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'RETURN_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'RETURN_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'RETURN_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'RETURN_PICKED_UP';
ALTER TYPE "NotificationType" ADD VALUE 'RETURN_RECEIVED';

-- DropIndex
DROP INDEX "Return_orderId_key";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "returnable" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Return" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "inspectionNote" TEXT,
ADD COLUMN     "media" JSONB,
ADD COLUMN     "pickedUpAt" TIMESTAMP(3),
ADD COLUMN     "pickupAwb" TEXT,
ADD COLUMN     "pickupMode" TEXT,
ADD COLUMN     "pickupStatus" TEXT,
ADD COLUMN     "pickupTrackingUrl" TEXT,
ADD COLUMN     "reasonCode" TEXT,
ADD COLUMN     "receivedAt" TIMESTAMP(3),
ADD COLUMN     "receivedBy" TEXT,
ADD COLUMN     "refundUpiId" TEXT,
ADD COLUMN     "shippingRefund" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "ReturnItem" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "acceptedQuantity" INTEGER,
    "restocked" BOOLEAN NOT NULL DEFAULT false,
    "refundAmount" DECIMAL(12,2),

    CONSTRAINT "ReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnRefund" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "channel" "ReturnRefundChannel" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "ReturnRefundStatus" NOT NULL DEFAULT 'PENDING',
    "razorpayRefundId" TEXT,
    "manualReference" TEXT,
    "settledBy" TEXT,
    "failureReason" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturnRefund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReturnItem_orderItemId_idx" ON "ReturnItem"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnItem_returnId_orderItemId_key" ON "ReturnItem"("returnId", "orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnRefund_razorpayRefundId_key" ON "ReturnRefund"("razorpayRefundId");

-- CreateIndex
CREATE INDEX "ReturnRefund_orderId_idx" ON "ReturnRefund"("orderId");

-- CreateIndex
CREATE INDEX "ReturnRefund_status_idx" ON "ReturnRefund"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnRefund_returnId_channel_key" ON "ReturnRefund"("returnId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "Return_idempotencyKey_key" ON "Return"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Return_pickupAwb_key" ON "Return"("pickupAwb");

-- CreateIndex
CREATE INDEX "Return_orderId_idx" ON "Return"("orderId");

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "Return"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRefund" ADD CONSTRAINT "ReturnRefund_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "Return"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRefund" ADD CONSTRAINT "ReturnRefund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

