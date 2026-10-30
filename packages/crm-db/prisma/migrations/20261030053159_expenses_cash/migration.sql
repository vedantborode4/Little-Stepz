-- CreateEnum
CREATE TYPE "public"."ExpenseKind" AS ENUM ('OPERATING', 'ORDER');

-- CreateEnum
CREATE TYPE "public"."CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "public"."ExpenseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Expense" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "kind" "public"."ExpenseKind" NOT NULL,
    "orderId" TEXT,
    "accountId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "businessDate" DATE NOT NULL,
    "vendor" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "reversalOfId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CashSession" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "status" "public"."CashSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openingAmount" DECIMAL(14,2) NOT NULL,
    "expectedAmount" DECIMAL(14,2),
    "countedAmount" DECIMAL(14,2),
    "discrepancy" DECIMAL(14,2),
    "notes" TEXT,
    "openedById" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_nameKey_key" ON "public"."ExpenseCategory"("nameKey");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_code_key" ON "public"."Expense"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_reversalOfId_key" ON "public"."Expense"("reversalOfId");

-- CreateIndex
CREATE INDEX "Expense_businessDate_idx" ON "public"."Expense"("businessDate");

-- CreateIndex
CREATE INDEX "Expense_accountId_businessDate_idx" ON "public"."Expense"("accountId", "businessDate");

-- CreateIndex
CREATE INDEX "Expense_orderId_idx" ON "public"."Expense"("orderId");

-- CreateIndex
CREATE INDEX "CashSession_businessDate_idx" ON "public"."CashSession"("businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "CashSession_accountId_businessDate_key" ON "public"."CashSession"("accountId", "businessDate");

-- AddForeignKey
ALTER TABLE "public"."Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Expense" ADD CONSTRAINT "Expense_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Expense" ADD CONSTRAINT "Expense_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."ReceivingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Expense" ADD CONSTRAINT "Expense_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "public"."Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CashSession" ADD CONSTRAINT "CashSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."ReceivingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CashSession" ADD CONSTRAINT "CashSession_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CashSession" ADD CONSTRAINT "CashSession_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TRIGGER "Expense_append_only" BEFORE UPDATE OR DELETE ON "Expense"
  FOR EACH ROW EXECUTE FUNCTION crm_reject_mutation();

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_valid" CHECK (amount > 0 AND (kind <> 'ORDER' OR "orderId" IS NOT NULL));
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_amounts_valid" CHECK (
  "openingAmount" >= 0 AND ("countedAmount" IS NULL OR "countedAmount" >= 0)
  AND (status = 'OPEN' OR ("countedAmount" IS NOT NULL AND "expectedAmount" IS NOT NULL AND discrepancy = "countedAmount" - "expectedAmount"))
);
