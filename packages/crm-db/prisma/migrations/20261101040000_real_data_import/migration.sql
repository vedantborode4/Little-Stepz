-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."ImportKind" ADD VALUE 'HISTORICAL_SALES';
ALTER TYPE "public"."ImportKind" ADD VALUE 'EXPENSES';

-- AlterTable
ALTER TABLE "public"."Category" ADD COLUMN     "gstRate" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "public"."ImportBatch" ADD COLUMN     "headerRow" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "options" JSONB,
ADD COLUMN     "sheetName" TEXT,
ADD COLUMN     "summary" JSONB;

-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "gstFromCategory" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."SalesOrder" ADD COLUMN     "importBatchId" TEXT;

-- CreateIndex
CREATE INDEX "SalesOrder_importBatchId_idx" ON "public"."SalesOrder"("importBatchId");

-- AddForeignKey
ALTER TABLE "public"."SalesOrder" ADD CONSTRAINT "SalesOrder_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "public"."ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

