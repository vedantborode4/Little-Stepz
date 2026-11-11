-- AlterTable
ALTER TABLE "public"."SalesOrder" ADD COLUMN     "commissionRate" DECIMAL(5,2),
ADD COLUMN     "salespersonId" TEXT;

-- AlterTable
ALTER TABLE "public"."Expense" ADD COLUMN     "salespersonId" TEXT;

-- CreateTable
CREATE TABLE "public"."Salesperson" (
    "id" TEXT NOT NULL,
    "staffCode" TEXT NOT NULL,
    "staffKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "commissionRate" DECIMAL(5,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Salesperson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Salesperson_staffKey_key" ON "public"."Salesperson"("staffKey");

-- CreateIndex
CREATE INDEX "SalesOrder_salespersonId_idx" ON "public"."SalesOrder"("salespersonId");

-- CreateIndex
CREATE INDEX "Expense_salespersonId_idx" ON "public"."Expense"("salespersonId");

-- AddForeignKey
ALTER TABLE "public"."SalesOrder" ADD CONSTRAINT "SalesOrder_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "public"."Salesperson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Expense" ADD CONSTRAINT "Expense_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "public"."Salesperson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A rate is a percentage, and a sale carries one exactly when it has a salesperson.
ALTER TABLE "Salesperson" ADD CONSTRAINT "Salesperson_rate_valid" CHECK ("commissionRate" >= 0 AND "commissionRate" <= 100);
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_commission_pair" CHECK (("salespersonId" IS NULL) = ("commissionRate" IS NULL));

-- Payouts are recorded as expenses in this category.
INSERT INTO "ExpenseCategory" ("id", "name", "nameKey", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'Staff commission', 'staff commission', true, now(), now())
ON CONFLICT ("nameKey") DO NOTHING;
