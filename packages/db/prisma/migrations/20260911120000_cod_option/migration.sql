-- Cash on Delivery restored as a per-product checkout option.
--
-- Product defaults to false so this migration opts nothing in; Variant defaults to true
-- so a variant inherits its product and can only ever opt out. Both are constant-default
-- booleans, which on PG11+ is a catalog-only ADD COLUMN with no table rewrite.
ALTER TABLE "Product" ADD COLUMN "codEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Variant" ADD COLUMN "codEnabled" BOOLEAN NOT NULL DEFAULT true;

-- The checkout quote counts a customer's undelivered and refused COD orders on every
-- call, so both filters get an index rather than a scan of that customer's order history.
CREATE INDEX "Order_userId_paymentMethod_status_idx" ON "Order"("userId", "paymentMethod", "status");
