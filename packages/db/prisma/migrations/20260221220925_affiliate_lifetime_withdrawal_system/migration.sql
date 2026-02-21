/*
  Warnings:

  - A unique constraint covering the columns `[affiliateId,orderId]` on the table `Commission` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('PER_ORDER', 'LIFETIME');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'REJECTED');

-- AlterTable
ALTER TABLE "Affiliate" ADD COLUMN     "adminNote" TEXT,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "commissionType" "CommissionType" NOT NULL DEFAULT 'LIFETIME',
ADD COLUMN     "paidOutBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "payoutDetails" JSONB,
ADD COLUMN     "pendingBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
ALTER COLUMN "commissionRate" SET DEFAULT 0.05;

-- AlterTable
ALTER TABLE "AffiliateClick" ADD COLUMN     "convertedAt" TIMESTAMP(3),
ADD COLUMN     "country" TEXT,
ADD COLUMN     "ipDateKey" TEXT,
ADD COLUMN     "isUnique" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sessionId" TEXT;

-- AlterTable
ALTER TABLE "Commission" ADD COLUMN     "withdrawalId" TEXT;

-- CreateTable
CREATE TABLE "AffiliateWithdrawal" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "payoutDetails" JSONB,
    "adminNote" TEXT,
    "processedBy" TEXT,
    "processedAt" TIMESTAMP(3),
    "transactionRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AffiliateWithdrawal_affiliateId_status_idx" ON "AffiliateWithdrawal"("affiliateId", "status");

-- CreateIndex
CREATE INDEX "AffiliateWithdrawal_status_idx" ON "AffiliateWithdrawal"("status");

-- CreateIndex
CREATE INDEX "Affiliate_referralCode_idx" ON "Affiliate"("referralCode");

-- CreateIndex
CREATE INDEX "AffiliateClick_ipDateKey_idx" ON "AffiliateClick"("ipDateKey");

-- CreateIndex
CREATE INDEX "AffiliateClick_affiliateId_isUnique_idx" ON "AffiliateClick"("affiliateId", "isUnique");

-- CreateIndex
CREATE INDEX "AffiliateConversion_affiliateId_status_idx" ON "AffiliateConversion"("affiliateId", "status");

-- CreateIndex
CREATE INDEX "Commission_withdrawalId_idx" ON "Commission"("withdrawalId");

-- CreateIndex
CREATE UNIQUE INDEX "Commission_affiliateId_orderId_key" ON "Commission"("affiliateId", "orderId");

-- CreateIndex
CREATE INDEX "Order_affiliateId_idx" ON "Order"("affiliateId");

-- CreateIndex
CREATE INDEX "User_referralCode_idx" ON "User"("referralCode");

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "AffiliateWithdrawal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateWithdrawal" ADD CONSTRAINT "AffiliateWithdrawal_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
