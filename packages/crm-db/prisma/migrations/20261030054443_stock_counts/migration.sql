-- CreateEnum
CREATE TYPE "public"."StockCountStatus" AS ENUM ('OPEN', 'SUBMITTED', 'APPROVED', 'CANCELLED', 'REVERSED');

-- CreateTable
CREATE TABLE "public"."StockCount" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "categoryId" TEXT,
    "blind" BOOLEAN NOT NULL DEFAULT true,
    "status" "public"."StockCountStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdById" TEXT,
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "adjustmentDocumentId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StockCountLine" (
    "id" TEXT NOT NULL,
    "countId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "systemQty" INTEGER NOT NULL,
    "countedQty" INTEGER,
    "reasonCode" "public"."StockReasonCode",
    "note" TEXT,
    "countedAt" TIMESTAMP(3),

    CONSTRAINT "StockCountLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockCount_code_key" ON "public"."StockCount"("code");

-- CreateIndex
CREATE UNIQUE INDEX "StockCount_adjustmentDocumentId_key" ON "public"."StockCount"("adjustmentDocumentId");

-- CreateIndex
CREATE INDEX "StockCount_status_idx" ON "public"."StockCount"("status");

-- CreateIndex
CREATE INDEX "StockCount_locationId_idx" ON "public"."StockCount"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "StockCountLine_countId_variantId_key" ON "public"."StockCountLine"("countId", "variantId");

-- AddForeignKey
ALTER TABLE "public"."StockCount" ADD CONSTRAINT "StockCount_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockCount" ADD CONSTRAINT "StockCount_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockCount" ADD CONSTRAINT "StockCount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockCount" ADD CONSTRAINT "StockCount_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockCount" ADD CONSTRAINT "StockCount_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockCount" ADD CONSTRAINT "StockCount_adjustmentDocumentId_fkey" FOREIGN KEY ("adjustmentDocumentId") REFERENCES "public"."StockDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockCountLine" ADD CONSTRAINT "StockCountLine_countId_fkey" FOREIGN KEY ("countId") REFERENCES "public"."StockCount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockCountLine" ADD CONSTRAINT "StockCountLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "public"."Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Once a count is approved, cancelled or reversed its lines are the record.
CREATE OR REPLACE FUNCTION crm_count_line_locked() RETURNS trigger AS $$
DECLARE
  parent_status text;
BEGIN
  SELECT status INTO parent_status FROM "StockCount" WHERE id = COALESCE(NEW."countId", OLD."countId");
  IF TG_OP = 'DELETE' OR parent_status IN ('APPROVED', 'CANCELLED', 'REVERSED') THEN
    RAISE EXCEPTION 'Lines of a % stock count are locked', COALESCE(parent_status, 'deleted') USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StockCountLine_locked" BEFORE UPDATE OR DELETE ON "StockCountLine"
  FOR EACH ROW EXECUTE FUNCTION crm_count_line_locked();

CREATE TRIGGER "StockCount_no_delete" BEFORE DELETE ON "StockCount"
  FOR EACH ROW EXECUTE FUNCTION crm_reject_mutation();

ALTER TABLE "StockCountLine" ADD CONSTRAINT "StockCountLine_valid" CHECK ("systemQty" >= 0 AND ("countedQty" IS NULL OR "countedQty" >= 0));
