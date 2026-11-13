-- Landed costs set by hand after stock is in: the entry, and the sales lines it costed (so a later entry can re-cost them).
-- AlterEnum
ALTER TYPE "public"."ImportKind" ADD VALUE 'LANDED_COSTS';

-- CreateTable
CREATE TABLE "public"."LandedCostEntry" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "unitCost" DECIMAL(18,6) NOT NULL,
    "previousUnitCost" DECIMAL(18,6),
    "stockQty" INTEGER NOT NULL,
    "unknownStockQty" INTEGER NOT NULL,
    "stockValueChange" DECIMAL(18,6) NOT NULL,
    "filledSoldQty" INTEGER NOT NULL,
    "recostedSoldQty" INTEGER NOT NULL,
    "cogsChange" DECIMAL(18,6) NOT NULL,
    "reason" TEXT NOT NULL,
    "importBatchId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LandedCostEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LandedCostSaleLine" (
    "id" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(18,6) NOT NULL,
    "entryId" TEXT NOT NULL,

    CONSTRAINT "LandedCostSaleLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LandedCostEntry_code_key" ON "public"."LandedCostEntry"("code");

-- CreateIndex
CREATE INDEX "LandedCostEntry_variantId_createdAt_idx" ON "public"."LandedCostEntry"("variantId", "createdAt");

-- CreateIndex
CREATE INDEX "LandedCostEntry_importBatchId_idx" ON "public"."LandedCostEntry"("importBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "LandedCostSaleLine_orderLineId_key" ON "public"."LandedCostSaleLine"("orderLineId");

-- CreateIndex
CREATE INDEX "LandedCostSaleLine_variantId_idx" ON "public"."LandedCostSaleLine"("variantId");

-- CreateIndex
CREATE INDEX "LandedCostSaleLine_entryId_idx" ON "public"."LandedCostSaleLine"("entryId");

-- AddForeignKey
ALTER TABLE "public"."LandedCostEntry" ADD CONSTRAINT "LandedCostEntry_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "public"."Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LandedCostEntry" ADD CONSTRAINT "LandedCostEntry_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "public"."ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LandedCostEntry" ADD CONSTRAINT "LandedCostEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LandedCostSaleLine" ADD CONSTRAINT "LandedCostSaleLine_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "public"."SalesOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LandedCostSaleLine" ADD CONSTRAINT "LandedCostSaleLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "public"."LandedCostEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

