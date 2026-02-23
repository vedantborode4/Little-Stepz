-- AlterTable
ALTER TABLE "Commission" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT;

-- CreateIndex
CREATE INDEX "Commission_status_idx" ON "Commission"("status");
