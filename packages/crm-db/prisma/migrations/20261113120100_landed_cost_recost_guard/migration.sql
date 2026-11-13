-- A landed cost set after the stock is in may re-cost units already sold. Only the
-- transaction writing that LandedCostEntry may do it: it names the entry in the
-- transaction-local setting crm.landed_cost_entry, and the entry must exist.
CREATE OR REPLACE FUNCTION crm_landed_cost_in_progress() RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM "LandedCostEntry" WHERE id = NULLIF(current_setting('crm.landed_cost_entry', true), '')
  );
$$ LANGUAGE sql STABLE;

-- Lines are price snapshots: once the order leaves DRAFT only the cost fixed at
-- deduction (cogs, unknownCostQty) may be filled in, and only once — except by a landed-cost entry.
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
    OR (OLD.cogs IS NOT NULL AND NEW.cogs IS DISTINCT FROM OLD.cogs AND NOT crm_landed_cost_in_progress())
  ) THEN
    RAISE EXCEPTION 'Lines of a % order are locked', parent_status USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Return lines stay append-only, but a landed-cost entry may re-cost them (cost columns only).
CREATE OR REPLACE FUNCTION crm_sales_return_line_locked() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND crm_landed_cost_in_progress()
    AND (NEW.id, NEW."returnId", NEW."orderLineId", NEW."variantId", NEW.quantity, NEW.condition, NEW.amount, NEW."taxableValue", NEW."gstAmount")
      IS NOT DISTINCT FROM (OLD.id, OLD."returnId", OLD."orderLineId", OLD."variantId", OLD.quantity, OLD.condition, OLD.amount, OLD."taxableValue", OLD."gstAmount")
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER "SalesReturnLine_append_only" ON "SalesReturnLine";
CREATE TRIGGER "SalesReturnLine_append_only" BEFORE UPDATE OR DELETE ON "SalesReturnLine"
  FOR EACH ROW EXECUTE FUNCTION crm_sales_return_line_locked();

-- Entries are the record of what was changed and why.
CREATE TRIGGER "LandedCostEntry_append_only" BEFORE UPDATE OR DELETE ON "LandedCostEntry"
  FOR EACH ROW EXECUTE FUNCTION crm_reject_mutation();

-- A sold unit's landed cost is re-pointed by later entries, never removed.
CREATE TRIGGER "LandedCostSaleLine_no_delete" BEFORE DELETE ON "LandedCostSaleLine"
  FOR EACH ROW EXECUTE FUNCTION crm_reject_mutation();
