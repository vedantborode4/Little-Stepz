-- Payments and credit entries are append-only, with one exception: merging two
-- customers re-points their rows at the customer that is kept. Any other change,
-- and every delete, is still rejected.
CREATE OR REPLACE FUNCTION crm_customer_link_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (to_jsonb(NEW) - 'customerId') IS DISTINCT FROM (to_jsonb(OLD) - 'customerId') THEN
    RAISE EXCEPTION '% rows are append-only', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER "Payment_append_only" ON "Payment";
CREATE TRIGGER "Payment_append_only" BEFORE UPDATE OR DELETE ON "Payment"
  FOR EACH ROW EXECUTE FUNCTION crm_customer_link_only();

DROP TRIGGER "CustomerCreditEntry_append_only" ON "CustomerCreditEntry";
CREATE TRIGGER "CustomerCreditEntry_append_only" BEFORE UPDATE OR DELETE ON "CustomerCreditEntry"
  FOR EACH ROW EXECUTE FUNCTION crm_customer_link_only();
