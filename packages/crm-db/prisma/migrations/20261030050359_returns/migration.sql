-- CreateEnum
CREATE TYPE "public"."ReturnCondition" AS ENUM ('RESELLABLE', 'DAMAGED', 'WRITE_OFF');

-- CreateEnum
CREATE TYPE "public"."RefundMethod" AS ENUM ('NONE', 'REFUND', 'CREDIT');

-- AlterEnum
ALTER TYPE "public"."CreditEntryType" ADD VALUE 'RETURN';

-- CreateTable
CREATE TABLE "public"."SalesReturn" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "taxableValue" DECIMAL(14,2) NOT NULL,
    "gstAmount" DECIMAL(14,2) NOT NULL,
    "shippingRefund" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "refundMethod" "public"."RefundMethod" NOT NULL,
    "refundAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paymentId" TEXT,
    "creditEntryId" TEXT,
    "stockDocumentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SalesReturnLine" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "condition" "public"."ReturnCondition" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "taxableValue" DECIMAL(14,2) NOT NULL,
    "gstAmount" DECIMAL(14,2) NOT NULL,
    "cogs" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "unknownCostQty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SalesReturnLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesReturn_code_key" ON "public"."SalesReturn"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SalesReturn_paymentId_key" ON "public"."SalesReturn"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesReturn_creditEntryId_key" ON "public"."SalesReturn"("creditEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesReturn_stockDocumentId_key" ON "public"."SalesReturn"("stockDocumentId");

-- CreateIndex
CREATE INDEX "SalesReturn_orderId_idx" ON "public"."SalesReturn"("orderId");

-- CreateIndex
CREATE INDEX "SalesReturn_businessDate_idx" ON "public"."SalesReturn"("businessDate");

-- CreateIndex
CREATE INDEX "SalesReturnLine_orderLineId_idx" ON "public"."SalesReturnLine"("orderLineId");

-- AddForeignKey
ALTER TABLE "public"."SalesReturn" ADD CONSTRAINT "SalesReturn_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesReturn" ADD CONSTRAINT "SalesReturn_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesReturn" ADD CONSTRAINT "SalesReturn_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesReturn" ADD CONSTRAINT "SalesReturn_creditEntryId_fkey" FOREIGN KEY ("creditEntryId") REFERENCES "public"."CustomerCreditEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesReturn" ADD CONSTRAINT "SalesReturn_stockDocumentId_fkey" FOREIGN KEY ("stockDocumentId") REFERENCES "public"."StockDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesReturn" ADD CONSTRAINT "SalesReturn_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesReturnLine" ADD CONSTRAINT "SalesReturnLine_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "public"."SalesReturn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesReturnLine" ADD CONSTRAINT "SalesReturnLine_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "public"."SalesOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesReturnLine" ADD CONSTRAINT "SalesReturnLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "public"."Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER "SalesReturn_append_only" BEFORE UPDATE OR DELETE ON "SalesReturn"
  FOR EACH ROW EXECUTE FUNCTION crm_reject_mutation();
CREATE TRIGGER "SalesReturnLine_append_only" BEFORE UPDATE OR DELETE ON "SalesReturnLine"
  FOR EACH ROW EXECUTE FUNCTION crm_reject_mutation();

ALTER TABLE "SalesReturn" ADD CONSTRAINT "SalesReturn_amounts_valid" CHECK (
  amount >= 0 AND "taxableValue" >= 0 AND "gstAmount" >= 0 AND "shippingRefund" >= 0 AND "refundAmount" >= 0
  AND "refundAmount" <= amount
  AND (("refundMethod" = 'NONE') = ("refundAmount" = 0))
);
ALTER TABLE "SalesReturnLine" ADD CONSTRAINT "SalesReturnLine_valid" CHECK (
  quantity > 0 AND amount >= 0 AND "taxableValue" >= 0 AND "gstAmount" >= 0 AND cogs >= 0
  AND "unknownCostQty" BETWEEN 0 AND quantity
);
