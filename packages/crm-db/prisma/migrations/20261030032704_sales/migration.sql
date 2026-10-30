-- CreateEnum
CREATE TYPE "public"."SalesOrderType" AS ENUM ('REGULAR', 'PRE_ORDER');

-- CreateEnum
CREATE TYPE "public"."SalesChannel" AS ENUM ('STORE', 'WEBSITE', 'WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'WHOLESALE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."SalesOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PACKED', 'DISPATCHED', 'DELIVERED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."FulfilmentMethod" AS ENUM ('COUNTER', 'DELIVERY');

-- CreateEnum
CREATE TYPE "public"."PriceSource" AS ENUM ('CUSTOMER', 'TIER', 'WHOLESALE', 'OFFER', 'REGULAR', 'MANUAL');

-- CreateTable
CREATE TABLE "public"."SalesOrder" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "public"."SalesOrderType" NOT NULL DEFAULT 'REGULAR',
    "channel" "public"."SalesChannel" NOT NULL,
    "fulfilment" "public"."FulfilmentMethod" NOT NULL,
    "status" "public"."SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "customerId" TEXT,
    "customerName" TEXT,
    "locationId" TEXT NOT NULL,
    "wholesale" BOOLEAN NOT NULL DEFAULT false,
    "isInterState" BOOLEAN NOT NULL DEFAULT false,
    "orderDate" DATE NOT NULL,
    "dueDate" DATE,
    "expectedArrival" DATE,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "lineDiscounts" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "orderDiscount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "shippingCharged" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(14,2) NOT NULL,
    "taxableTotal" DECIMAL(14,2) NOT NULL,
    "gstTotal" DECIMAL(14,2) NOT NULL,
    "externalRef" TEXT,
    "notes" TEXT,
    "idempotencyKey" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "fulfilledDate" DATE,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "stockDocumentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SalesOrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "regularPrice" DECIMAL(14,2) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "priceSource" "public"."PriceSource" NOT NULL,
    "lineDiscount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "orderDiscountShare" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(14,2) NOT NULL,
    "gstRate" DECIMAL(5,2) NOT NULL,
    "taxableValue" DECIMAL(14,2) NOT NULL,
    "gstAmount" DECIMAL(14,2) NOT NULL,
    "cogs" DECIMAL(18,6),
    "unknownCostQty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SalesOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Reservation" (
    "id" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "releaseReason" TEXT,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SalesOrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" "public"."SalesOrderStatus",
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesOrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_code_key" ON "public"."SalesOrder"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_idempotencyKey_key" ON "public"."SalesOrder"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_stockDocumentId_key" ON "public"."SalesOrder"("stockDocumentId");

-- CreateIndex
CREATE INDEX "SalesOrder_status_orderDate_idx" ON "public"."SalesOrder"("status", "orderDate");

-- CreateIndex
CREATE INDEX "SalesOrder_customerId_idx" ON "public"."SalesOrder"("customerId");

-- CreateIndex
CREATE INDEX "SalesOrder_fulfilledDate_idx" ON "public"."SalesOrder"("fulfilledDate");

-- CreateIndex
CREATE INDEX "SalesOrder_channel_idx" ON "public"."SalesOrder"("channel");

-- CreateIndex
CREATE INDEX "SalesOrder_type_status_idx" ON "public"."SalesOrder"("type", "status");

-- CreateIndex
CREATE INDEX "SalesOrderLine_variantId_idx" ON "public"."SalesOrderLine"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrderLine_orderId_variantId_key" ON "public"."SalesOrderLine"("orderId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_orderLineId_key" ON "public"."Reservation"("orderLineId");

-- CreateIndex
CREATE INDEX "Reservation_variantId_locationId_releasedAt_idx" ON "public"."Reservation"("variantId", "locationId", "releasedAt");

-- CreateIndex
CREATE INDEX "SalesOrderEvent_orderId_createdAt_idx" ON "public"."SalesOrderEvent"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."SalesOrder" ADD CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesOrder" ADD CONSTRAINT "SalesOrder_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesOrder" ADD CONSTRAINT "SalesOrder_stockDocumentId_fkey" FOREIGN KEY ("stockDocumentId") REFERENCES "public"."StockDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesOrder" ADD CONSTRAINT "SalesOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "public"."Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reservation" ADD CONSTRAINT "Reservation_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "public"."SalesOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reservation" ADD CONSTRAINT "Reservation_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "public"."Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reservation" ADD CONSTRAINT "Reservation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesOrderEvent" ADD CONSTRAINT "SalesOrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesOrderEvent" ADD CONSTRAINT "SalesOrderEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Past DRAFT an order is a financial record: its amounts and terms are frozen
-- (status, dates of fulfilment/cancellation, notes and the customer link for
-- merges stay updatable). Corrections are returns and refunds, never edits.
CREATE OR REPLACE FUNCTION crm_sales_order_locked() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'DRAFT' THEN
      RAISE EXCEPTION 'Order % is % and can''t be deleted', OLD.code, OLD.status USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status <> 'DRAFT' AND (
    NEW.code IS DISTINCT FROM OLD.code OR NEW.type IS DISTINCT FROM OLD.type OR NEW.channel IS DISTINCT FROM OLD.channel
    OR NEW.fulfilment IS DISTINCT FROM OLD.fulfilment OR NEW."locationId" IS DISTINCT FROM OLD."locationId"
    OR NEW.wholesale IS DISTINCT FROM OLD.wholesale OR NEW."orderDate" IS DISTINCT FROM OLD."orderDate"
    OR NEW.subtotal IS DISTINCT FROM OLD.subtotal OR NEW."lineDiscounts" IS DISTINCT FROM OLD."lineDiscounts"
    OR NEW."orderDiscount" IS DISTINCT FROM OLD."orderDiscount" OR NEW."shippingCharged" IS DISTINCT FROM OLD."shippingCharged"
    OR NEW."grandTotal" IS DISTINCT FROM OLD."grandTotal" OR NEW."taxableTotal" IS DISTINCT FROM OLD."taxableTotal"
    OR NEW."gstTotal" IS DISTINCT FROM OLD."gstTotal"
    OR (OLD."stockDocumentId" IS NOT NULL AND NEW."stockDocumentId" IS DISTINCT FROM OLD."stockDocumentId")
    OR (OLD."fulfilledAt" IS NOT NULL AND NEW."fulfilledAt" IS DISTINCT FROM OLD."fulfilledAt")
  ) THEN
    RAISE EXCEPTION 'Order % is % and its amounts can no longer change', OLD.code, OLD.status USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SalesOrder_locked_after_draft" BEFORE UPDATE OR DELETE ON "SalesOrder"
  FOR EACH ROW EXECUTE FUNCTION crm_sales_order_locked();

-- Lines are price snapshots: once the order leaves DRAFT only the cost fixed at
-- deduction (cogs, unknownCostQty) may be filled in, and only once.
CREATE OR REPLACE FUNCTION crm_sales_line_locked() RETURNS trigger AS $$
DECLARE
  parent_status text;
BEGIN
  SELECT status INTO parent_status FROM "SalesOrder" WHERE id = COALESCE(NEW."orderId", OLD."orderId");
  IF parent_status IS NULL OR parent_status = 'DRAFT' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP <> 'UPDATE' OR (
    NEW."variantId" IS DISTINCT FROM OLD."variantId" OR NEW.quantity IS DISTINCT FROM OLD.quantity
    OR NEW."regularPrice" IS DISTINCT FROM OLD."regularPrice" OR NEW."unitPrice" IS DISTINCT FROM OLD."unitPrice"
    OR NEW."priceSource" IS DISTINCT FROM OLD."priceSource" OR NEW."lineDiscount" IS DISTINCT FROM OLD."lineDiscount"
    OR NEW."orderDiscountShare" IS DISTINCT FROM OLD."orderDiscountShare" OR NEW."lineTotal" IS DISTINCT FROM OLD."lineTotal"
    OR NEW."gstRate" IS DISTINCT FROM OLD."gstRate" OR NEW."taxableValue" IS DISTINCT FROM OLD."taxableValue"
    OR NEW."gstAmount" IS DISTINCT FROM OLD."gstAmount"
    OR (OLD.cogs IS NOT NULL AND NEW.cogs IS DISTINCT FROM OLD.cogs)
  ) THEN
    RAISE EXCEPTION 'Lines of a % order are locked', parent_status USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SalesOrderLine_locked_after_draft" BEFORE INSERT OR UPDATE OR DELETE ON "SalesOrderLine"
  FOR EACH ROW EXECUTE FUNCTION crm_sales_line_locked();

-- A reservation is released once and never deleted, so "why was this held" stays answerable.
CREATE OR REPLACE FUNCTION crm_reservation_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD."releasedAt" IS NOT NULL
    OR NEW.quantity IS DISTINCT FROM OLD.quantity OR NEW."variantId" IS DISTINCT FROM OLD."variantId"
    OR NEW."locationId" IS DISTINCT FROM OLD."locationId" OR NEW."orderLineId" IS DISTINCT FROM OLD."orderLineId" THEN
    RAISE EXCEPTION 'Reservations can only be released, once' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Reservation_release_only" BEFORE UPDATE OR DELETE ON "Reservation"
  FOR EACH ROW EXECUTE FUNCTION crm_reservation_guard();

CREATE TRIGGER "SalesOrderEvent_append_only" BEFORE UPDATE OR DELETE ON "SalesOrderEvent"
  FOR EACH ROW EXECUTE FUNCTION crm_reject_mutation();

ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_amounts_valid" CHECK (
  subtotal >= 0 AND "lineDiscounts" >= 0 AND "orderDiscount" >= 0 AND "shippingCharged" >= 0
  AND "grandTotal" >= 0 AND "taxableTotal" >= 0 AND "gstTotal" >= 0
);
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_valid" CHECK (
  quantity > 0 AND "unitPrice" >= 0 AND "regularPrice" >= 0 AND "lineDiscount" >= 0 AND "orderDiscountShare" >= 0
  AND "lineTotal" >= 0 AND "taxableValue" >= 0 AND "gstAmount" >= 0
  AND "unknownCostQty" BETWEEN 0 AND quantity AND (cogs IS NULL OR cogs >= 0)
);
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_quantity_positive" CHECK (quantity > 0);
