-- Rename Shiprocket-specific columns to provider-neutral names (Delhivery migration).
-- Uses RENAME COLUMN to preserve existing data.

ALTER TABLE "Order" RENAME COLUMN "shiprocketOrderId" TO "providerRefId";
ALTER TABLE "Order" RENAME COLUMN "shiprocketShipmentId" TO "providerShipmentId";

ALTER TABLE "Shipment" RENAME COLUMN "shiprocketOrderId" TO "providerRefId";
ALTER TABLE "Shipment" RENAME COLUMN "shiprocketShipmentId" TO "providerShipmentId";
