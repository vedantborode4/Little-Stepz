-- CreateEnum
CREATE TYPE "public"."SupplierEntryType" AS ENUM ('OPENING', 'PAYMENT', 'GOODS_RECEIVED', 'REFUND', 'CREDIT_NOTE', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "public"."SupplierLedgerEntry" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "type" "public"."SupplierEntryType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "businessDate" DATE NOT NULL,
    "accountId" TEXT,
    "purchaseId" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "reversalOfId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierLedgerEntry_code_key" ON "public"."SupplierLedgerEntry"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierLedgerEntry_reversalOfId_key" ON "public"."SupplierLedgerEntry"("reversalOfId");

-- CreateIndex
CREATE INDEX "SupplierLedgerEntry_supplierId_businessDate_idx" ON "public"."SupplierLedgerEntry"("supplierId", "businessDate");

-- CreateIndex
CREATE INDEX "SupplierLedgerEntry_accountId_businessDate_idx" ON "public"."SupplierLedgerEntry"("accountId", "businessDate");

-- CreateIndex
CREATE INDEX "SupplierLedgerEntry_purchaseId_idx" ON "public"."SupplierLedgerEntry"("purchaseId");

-- AddForeignKey
ALTER TABLE "public"."SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."ReceivingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "public"."PurchaseShipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "public"."SupplierLedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


CREATE TRIGGER "SupplierLedgerEntry_append_only" BEFORE UPDATE OR DELETE ON "SupplierLedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION crm_reject_mutation();

-- Money only moves through an account on a payment or a refund; the sign follows
-- the type (a reversal carries the opposite sign of what it undoes).
ALTER TABLE "SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_valid" CHECK (
  amount <> 0
  AND ("accountId" IS NOT NULL) = (type IN ('PAYMENT', 'REFUND'))
  AND ("purchaseId" IS NULL OR type = 'GOODS_RECEIVED')
  AND (
    "reversalOfId" IS NOT NULL
    OR type IN ('OPENING', 'ADJUSTMENT')
    OR (type IN ('PAYMENT', 'CREDIT_NOTE') AND amount > 0)
    OR (type IN ('GOODS_RECEIVED', 'REFUND') AND amount < 0)
  )
);
