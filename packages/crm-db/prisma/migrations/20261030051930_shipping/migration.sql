-- CreateEnum
CREATE TYPE "public"."ShipmentStatus" AS ENUM ('PENDING', 'PACKED', 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RTO', 'RETURNED', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."CourierPartner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "trackingUrlTemplate" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourierPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Shipment" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "courierId" TEXT,
    "status" "public"."ShipmentStatus" NOT NULL DEFAULT 'PENDING',
    "courierCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "packedAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ShipmentPackage" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "awb" TEXT NOT NULL,
    "weightKg" DECIMAL(10,3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ShipmentEvent" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "status" "public"."ShipmentStatus" NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourierPartner_nameKey_key" ON "public"."CourierPartner"("nameKey");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_code_key" ON "public"."Shipment"("code");

-- CreateIndex
CREATE INDEX "Shipment_status_idx" ON "public"."Shipment"("status");

-- CreateIndex
CREATE INDEX "Shipment_orderId_idx" ON "public"."Shipment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentPackage_awb_key" ON "public"."ShipmentPackage"("awb");

-- CreateIndex
CREATE INDEX "ShipmentEvent_shipmentId_createdAt_idx" ON "public"."ShipmentEvent"("shipmentId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."Shipment" ADD CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Shipment" ADD CONSTRAINT "Shipment_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "public"."CourierPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Shipment" ADD CONSTRAINT "Shipment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShipmentPackage" ADD CONSTRAINT "ShipmentPackage_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "public"."Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShipmentEvent" ADD CONSTRAINT "ShipmentEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "public"."Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShipmentEvent" ADD CONSTRAINT "ShipmentEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TRIGGER "ShipmentEvent_append_only" BEFORE UPDATE OR DELETE ON "ShipmentEvent"
  FOR EACH ROW EXECUTE FUNCTION crm_reject_mutation();

-- A shipment's packages can be added while it's being prepared; once it has gone
-- out they're part of the record and can't be removed or changed.
CREATE OR REPLACE FUNCTION crm_package_locked() RETURNS trigger AS $$
DECLARE
  parent_status text;
BEGIN
  SELECT status INTO parent_status FROM "Shipment" WHERE id = COALESCE(NEW."shipmentId", OLD."shipmentId");
  IF parent_status NOT IN ('PENDING', 'PACKED') THEN
    RAISE EXCEPTION 'Packages of a % shipment are locked', parent_status USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ShipmentPackage_locked_after_dispatch" BEFORE UPDATE OR DELETE ON "ShipmentPackage"
  FOR EACH ROW EXECUTE FUNCTION crm_package_locked();

ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_cost_nonnegative" CHECK ("courierCost" >= 0);
ALTER TABLE "ShipmentPackage" ADD CONSTRAINT "ShipmentPackage_weight_positive" CHECK ("weightKg" IS NULL OR "weightKg" > 0);
