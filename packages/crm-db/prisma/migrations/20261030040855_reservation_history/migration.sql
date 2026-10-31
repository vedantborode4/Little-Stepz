-- DropIndex
DROP INDEX "public"."Reservation_orderLineId_key";

-- CreateIndex
CREATE INDEX "Reservation_orderLineId_idx" ON "public"."Reservation"("orderLineId");

-- A line may be reserved again after a release (pre-order allocations can be
-- undone and redone), but never twice at once. Prisma can't express a partial
-- unique index without schema drift, so the guard trigger enforces it on insert.
CREATE OR REPLACE FUNCTION crm_reservation_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (SELECT 1 FROM "Reservation" WHERE "orderLineId" = NEW."orderLineId" AND "releasedAt" IS NULL) THEN
      RAISE EXCEPTION 'Order line % already has an active reservation', NEW."orderLineId" USING ERRCODE = 'unique_violation';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' OR OLD."releasedAt" IS NOT NULL
    OR NEW.quantity IS DISTINCT FROM OLD.quantity OR NEW."variantId" IS DISTINCT FROM OLD."variantId"
    OR NEW."locationId" IS DISTINCT FROM OLD."locationId" OR NEW."orderLineId" IS DISTINCT FROM OLD."orderLineId" THEN
    RAISE EXCEPTION 'Reservations can only be released, once' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER "Reservation_release_only" ON "Reservation";
CREATE TRIGGER "Reservation_release_only" BEFORE INSERT OR UPDATE OR DELETE ON "Reservation"
  FOR EACH ROW EXECUTE FUNCTION crm_reservation_guard();
