-- The location is chosen when columns are mapped, so it is required from the check onwards, not at upload.
ALTER TABLE "ImportBatch" DROP CONSTRAINT "ImportBatch_opening_has_location";
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_opening_has_location"
  CHECK ("kind" <> 'OPENING_STOCK' OR "status" IN ('UPLOADED', 'CANCELLED') OR "locationId" IS NOT NULL);
