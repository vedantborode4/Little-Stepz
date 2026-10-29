-- CreateEnum
CREATE TYPE "public"."StockBucket" AS ENUM ('SELLABLE', 'DAMAGED', 'DEMO', 'QUARANTINE');

-- CreateEnum
CREATE TYPE "public"."StockDocumentType" AS ENUM ('OPENING', 'PURCHASE', 'SALE', 'SALE_RETURN', 'PURCHASE_RETURN', 'TRANSFER', 'BUCKET_MOVE', 'WRITE_OFF', 'ADJUSTMENT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "public"."StockReasonCode" AS ENUM ('MISSING', 'DAMAGED', 'DEMO_USE', 'THEFT', 'COUNT_CORRECTION', 'FOUND', 'DATA_ENTRY_ERROR', 'OTHER');

-- CreateTable
CREATE TABLE "public"."StockDocument" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "public"."StockDocumentType" NOT NULL,
    "businessDate" DATE NOT NULL,
    "reasonCode" "public"."StockReasonCode",
    "reason" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "reversalOfId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StockMovement" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "bucket" "public"."StockBucket" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(18,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StockBalance" (
    "variantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "bucket" "public"."StockBucket" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("variantId","locationId","bucket")
);

-- CreateTable
CREATE TABLE "public"."VariantCost" (
    "variantId" TEXT NOT NULL,
    "valuedQty" INTEGER NOT NULL DEFAULT 0,
    "totalValue" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "unvaluedQty" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VariantCost_pkey" PRIMARY KEY ("variantId")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockDocument_code_key" ON "public"."StockDocument"("code");

-- CreateIndex
CREATE UNIQUE INDEX "StockDocument_reversalOfId_key" ON "public"."StockDocument"("reversalOfId");

-- CreateIndex
CREATE INDEX "StockDocument_type_businessDate_idx" ON "public"."StockDocument"("type", "businessDate");

-- CreateIndex
CREATE INDEX "StockDocument_sourceType_sourceId_idx" ON "public"."StockDocument"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "StockDocument_createdAt_idx" ON "public"."StockDocument"("createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_variantId_createdAt_idx" ON "public"."StockMovement"("variantId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_locationId_idx" ON "public"."StockMovement"("locationId");

-- CreateIndex
CREATE INDEX "StockMovement_documentId_idx" ON "public"."StockMovement"("documentId");

-- CreateIndex
CREATE INDEX "StockBalance_locationId_bucket_idx" ON "public"."StockBalance"("locationId", "bucket");

-- AddForeignKey
ALTER TABLE "public"."StockDocument" ADD CONSTRAINT "StockDocument_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "public"."StockDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockDocument" ADD CONSTRAINT "StockDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockMovement" ADD CONSTRAINT "StockMovement_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."StockDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockMovement" ADD CONSTRAINT "StockMovement_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "public"."Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockMovement" ADD CONSTRAINT "StockMovement_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockBalance" ADD CONSTRAINT "StockBalance_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "public"."Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockBalance" ADD CONSTRAINT "StockBalance_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VariantCost" ADD CONSTRAINT "VariantCost_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "public"."Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ledger tables are append-only: corrections are REVERSAL documents.
CREATE TRIGGER "StockDocument_append_only_row" BEFORE UPDATE OR DELETE ON "StockDocument"
  FOR EACH ROW EXECUTE FUNCTION crm_reject_mutation();
CREATE TRIGGER "StockDocument_append_only_truncate" BEFORE TRUNCATE ON "StockDocument"
  FOR EACH STATEMENT EXECUTE FUNCTION crm_reject_mutation();
CREATE TRIGGER "StockMovement_append_only_row" BEFORE UPDATE OR DELETE ON "StockMovement"
  FOR EACH ROW EXECUTE FUNCTION crm_reject_mutation();
CREATE TRIGGER "StockMovement_append_only_truncate" BEFORE TRUNCATE ON "StockMovement"
  FOR EACH STATEMENT EXECUTE FUNCTION crm_reject_mutation();

ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_quantity_nonzero" CHECK ("quantity" <> 0);
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_cost_nonnegative" CHECK ("unitCost" IS NULL OR "unitCost" >= 0);
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_quantity_nonnegative" CHECK ("quantity" >= 0);
ALTER TABLE "VariantCost" ADD CONSTRAINT "VariantCost_nonnegative" CHECK ("valuedQty" >= 0 AND "unvaluedQty" >= 0 AND "totalValue" >= 0);
