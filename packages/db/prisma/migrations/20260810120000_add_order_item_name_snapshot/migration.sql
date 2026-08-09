-- Snapshot product/variant names on the order line.
-- `price` was already captured at order time; names were not, so renaming a product
-- rewrote the text of every historical invoice. Nullable so existing rows are valid
-- and fall back to the live relation.
ALTER TABLE "OrderItem" ADD COLUMN "productName" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "variantName" TEXT;
