-- CreateEnum
CREATE TYPE "public"."PaymentDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "public"."CreditEntryType" AS ENUM ('OVERPAYMENT', 'APPLIED', 'REFUNDED', 'CANCELLED_ORDER', 'REVERSAL');

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "direction" "public"."PaymentDirection" NOT NULL,
    "method" "public"."PaymentMethod" NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "fee" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "reference" TEXT,
    "businessDate" DATE NOT NULL,
    "customerId" TEXT,
    "notes" TEXT,
    "reversalOfId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PaymentAllocation" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentId" TEXT,
    "creditEntryId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerCreditEntry" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "public"."CreditEntryType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paymentId" TEXT,
    "orderId" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerCreditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AccountTransfer" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "fromAccountId" TEXT NOT NULL,
    "toAccountId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "businessDate" DATE NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "reversalOfId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_code_key" ON "public"."Payment"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reversalOfId_key" ON "public"."Payment"("reversalOfId");

-- CreateIndex
CREATE INDEX "Payment_businessDate_idx" ON "public"."Payment"("businessDate");

-- CreateIndex
CREATE INDEX "Payment_customerId_idx" ON "public"."Payment"("customerId");

-- CreateIndex
CREATE INDEX "Payment_accountId_businessDate_idx" ON "public"."Payment"("accountId", "businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_creditEntryId_key" ON "public"."PaymentAllocation"("creditEntryId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_orderId_idx" ON "public"."PaymentAllocation"("orderId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_paymentId_idx" ON "public"."PaymentAllocation"("paymentId");

-- CreateIndex
CREATE INDEX "CustomerCreditEntry_customerId_createdAt_idx" ON "public"."CustomerCreditEntry"("customerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccountTransfer_code_key" ON "public"."AccountTransfer"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AccountTransfer_reversalOfId_key" ON "public"."AccountTransfer"("reversalOfId");

-- CreateIndex
CREATE INDEX "AccountTransfer_businessDate_idx" ON "public"."AccountTransfer"("businessDate");

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."ReceivingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "public"."Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_creditEntryId_fkey" FOREIGN KEY ("creditEntryId") REFERENCES "public"."CustomerCreditEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerCreditEntry" ADD CONSTRAINT "CustomerCreditEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerCreditEntry" ADD CONSTRAINT "CustomerCreditEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerCreditEntry" ADD CONSTRAINT "CustomerCreditEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerCreditEntry" ADD CONSTRAINT "CustomerCreditEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccountTransfer" ADD CONSTRAINT "AccountTransfer_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "public"."ReceivingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccountTransfer" ADD CONSTRAINT "AccountTransfer_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "public"."ReceivingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccountTransfer" ADD CONSTRAINT "AccountTransfer_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "public"."AccountTransfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccountTransfer" ADD CONSTRAINT "AccountTransfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Money records are append-only; corrections are reversing rows.
CREATE TRIGGER "Payment_append_only" BEFORE UPDATE OR DELETE ON "Payment"
  FOR EACH ROW EXECUTE FUNCTION crm_reject_mutation();
CREATE TRIGGER "Payment_append_only_truncate" BEFORE TRUNCATE ON "Payment"
  FOR EACH STATEMENT EXECUTE FUNCTION crm_reject_mutation();
CREATE TRIGGER "PaymentAllocation_append_only" BEFORE UPDATE OR DELETE ON "PaymentAllocation"
  FOR EACH ROW EXECUTE FUNCTION crm_reject_mutation();
CREATE TRIGGER "CustomerCreditEntry_append_only" BEFORE UPDATE OR DELETE ON "CustomerCreditEntry"
  FOR EACH ROW EXECUTE FUNCTION crm_reject_mutation();
CREATE TRIGGER "AccountTransfer_append_only" BEFORE UPDATE OR DELETE ON "AccountTransfer"
  FOR EACH ROW EXECUTE FUNCTION crm_reject_mutation();

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amounts_valid" CHECK (amount > 0 AND fee >= 0 AND fee <= amount);
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_one_source" CHECK (
  amount <> 0 AND (("paymentId" IS NOT NULL) <> ("creditEntryId" IS NOT NULL))
);
ALTER TABLE "CustomerCreditEntry" ADD CONSTRAINT "CustomerCreditEntry_nonzero" CHECK (amount <> 0);
ALTER TABLE "AccountTransfer" ADD CONSTRAINT "AccountTransfer_valid" CHECK (amount > 0 AND "fromAccountId" <> "toAccountId");
