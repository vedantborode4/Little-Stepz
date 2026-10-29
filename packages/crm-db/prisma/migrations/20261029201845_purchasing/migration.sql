-- CreateEnum
CREATE TYPE "public"."PurchaseStatus" AS ENUM ('DRAFT', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."AllocationMethod" AS ENUM ('VALUE', 'QUANTITY', 'WEIGHT', 'VOLUME');

-- CreateEnum
CREATE TYPE "public"."ChargeType" AS ENUM ('FREIGHT', 'CUSTOMS_DUTY', 'CLEARING', 'IGST', 'GST', 'LOCAL_TRANSPORT', 'INSURANCE', 'OTHER');

-- CreateTable
CREATE TABLE "public"."PurchaseShipment" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "public"."PurchaseStatus" NOT NULL DEFAULT 'DRAFT',
    "supplierId" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "shipmentRef" TEXT,
    "invoiceDate" DATE NOT NULL,
    "currency" TEXT NOT NULL,
    "exchangeRate" DECIMAL(18,6) NOT NULL,
    "allocationMethod" "public"."AllocationMethod" NOT NULL DEFAULT 'VALUE',
    "locationId" TEXT NOT NULL,
    "notes" TEXT,
    "receivedAt" TIMESTAMP(3),
    "receivedDate" DATE,
    "receivedById" TEXT,
    "stockDocumentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseShipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PurchaseLine" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(18,6) NOT NULL,
    "weightKg" DECIMAL(12,3),
    "cbm" DECIMAL(12,6),
    "position" INTEGER NOT NULL,
    "unitPriceInr" DECIMAL(18,6),
    "allocatedCharges" DECIMAL(18,6),
    "landedUnitCost" DECIMAL(18,6),

    CONSTRAINT "PurchaseLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ShipmentCharge" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "type" "public"."ChargeType" NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "amountInr" DECIMAL(14,2) NOT NULL,
    "isRecoverableTax" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ShipmentCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CostAdjustment" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "type" "public"."ChargeType" NOT NULL,
    "description" TEXT,
    "amountInr" DECIMAL(14,2) NOT NULL,
    "isRecoverableTax" BOOLEAN NOT NULL,
    "allocationMethod" "public"."AllocationMethod" NOT NULL,
    "businessDate" DATE NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CostAdjustmentLine" (
    "id" TEXT NOT NULL,
    "adjustmentId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "allocated" DECIMAL(18,6) NOT NULL,
    "toInventory" DECIMAL(18,6) NOT NULL,
    "toCostOfSales" DECIMAL(18,6) NOT NULL,

    CONSTRAINT "CostAdjustmentLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PurchaseReturn" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "stockDocumentId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PurchaseReturnLine" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "purchaseLineId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "PurchaseReturnLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseShipment_code_key" ON "public"."PurchaseShipment"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseShipment_stockDocumentId_key" ON "public"."PurchaseShipment"("stockDocumentId");

-- CreateIndex
CREATE INDEX "PurchaseShipment_supplierId_idx" ON "public"."PurchaseShipment"("supplierId");

-- CreateIndex
CREATE INDEX "PurchaseShipment_status_invoiceDate_idx" ON "public"."PurchaseShipment"("status", "invoiceDate");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseLine_shipmentId_variantId_key" ON "public"."PurchaseLine"("shipmentId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "CostAdjustment_code_key" ON "public"."CostAdjustment"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReturn_code_key" ON "public"."PurchaseReturn"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReturn_stockDocumentId_key" ON "public"."PurchaseReturn"("stockDocumentId");

-- AddForeignKey
ALTER TABLE "public"."PurchaseShipment" ADD CONSTRAINT "PurchaseShipment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseShipment" ADD CONSTRAINT "PurchaseShipment_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseShipment" ADD CONSTRAINT "PurchaseShipment_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseShipment" ADD CONSTRAINT "PurchaseShipment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseLine" ADD CONSTRAINT "PurchaseLine_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "public"."PurchaseShipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseLine" ADD CONSTRAINT "PurchaseLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "public"."Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShipmentCharge" ADD CONSTRAINT "ShipmentCharge_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "public"."PurchaseShipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CostAdjustment" ADD CONSTRAINT "CostAdjustment_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "public"."PurchaseShipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CostAdjustment" ADD CONSTRAINT "CostAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CostAdjustmentLine" ADD CONSTRAINT "CostAdjustmentLine_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "public"."CostAdjustment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CostAdjustmentLine" ADD CONSTRAINT "CostAdjustmentLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "public"."Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "public"."PurchaseShipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseReturnLine" ADD CONSTRAINT "PurchaseReturnLine_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "public"."PurchaseReturn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseReturnLine" ADD CONSTRAINT "PurchaseReturnLine_purchaseLineId_fkey" FOREIGN KEY ("purchaseLineId") REFERENCES "public"."PurchaseLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseReturnLine" ADD CONSTRAINT "PurchaseReturnLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "public"."Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A received or cancelled purchase is a historical record: its header can't change.
CREATE OR REPLACE FUNCTION crm_purchase_locked() RETURNS trigger AS $$
BEGIN
  IF OLD.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Purchase % is % and can no longer be changed', OLD.code, OLD.status
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PurchaseShipment_locked_after_draft"
  BEFORE UPDATE OR DELETE ON "PurchaseShipment"
  FOR EACH ROW EXECUTE FUNCTION crm_purchase_locked();

-- Lines and charges follow their purchase: editable only while it is a draft, so
-- historical purchase prices and landed costs can never be overwritten.
CREATE OR REPLACE FUNCTION crm_purchase_child_locked() RETURNS trigger AS $$
DECLARE
  parent_status text;
BEGIN
  SELECT status INTO parent_status FROM "PurchaseShipment"
  WHERE id = COALESCE(NEW."shipmentId", OLD."shipmentId");
  IF parent_status IS NOT NULL AND parent_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Lines and charges of a % purchase are locked', parent_status
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PurchaseLine_locked_after_draft"
  BEFORE INSERT OR UPDATE OR DELETE ON "PurchaseLine"
  FOR EACH ROW EXECUTE FUNCTION crm_purchase_child_locked();
CREATE TRIGGER "ShipmentCharge_locked_after_draft"
  BEFORE INSERT OR UPDATE OR DELETE ON "ShipmentCharge"
  FOR EACH ROW EXECUTE FUNCTION crm_purchase_child_locked();

-- Cost adjustments and purchase returns are append-only.
CREATE TRIGGER "CostAdjustment_append_only" BEFORE UPDATE OR DELETE ON "CostAdjustment"
  FOR EACH ROW EXECUTE FUNCTION crm_reject_mutation();
CREATE TRIGGER "CostAdjustmentLine_append_only" BEFORE UPDATE OR DELETE ON "CostAdjustmentLine"
  FOR EACH ROW EXECUTE FUNCTION crm_reject_mutation();
CREATE TRIGGER "PurchaseReturn_append_only" BEFORE UPDATE OR DELETE ON "PurchaseReturn"
  FOR EACH ROW EXECUTE FUNCTION crm_reject_mutation();
CREATE TRIGGER "PurchaseReturnLine_append_only" BEFORE UPDATE OR DELETE ON "PurchaseReturnLine"
  FOR EACH ROW EXECUTE FUNCTION crm_reject_mutation();

ALTER TABLE "PurchaseShipment" ADD CONSTRAINT "PurchaseShipment_rate_positive" CHECK ("exchangeRate" > 0);
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_valid" CHECK (
  "quantity" > 0 AND "unitPrice" >= 0
  AND ("weightKg" IS NULL OR "weightKg" > 0) AND ("cbm" IS NULL OR "cbm" > 0)
);
ALTER TABLE "ShipmentCharge" ADD CONSTRAINT "ShipmentCharge_amount_positive" CHECK ("amount" > 0 AND "amountInr" > 0);
ALTER TABLE "PurchaseReturnLine" ADD CONSTRAINT "PurchaseReturnLine_quantity_positive" CHECK ("quantity" > 0);
