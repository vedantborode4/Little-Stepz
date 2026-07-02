-- Variant: SKU (optional, globally unique), display ordering, default flag
ALTER TABLE "Variant" ADD COLUMN "sku" TEXT;
ALTER TABLE "Variant" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Variant" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "Variant_sku_key" ON "Variant"("sku");
CREATE INDEX "Variant_productId_idx" ON "Variant"("productId");

-- Money precision: bring OrderItem.price in line with the rest of the schema.
-- Existing values are well within 12,2 (INR product prices) so the cast is safe.
ALTER TABLE "OrderItem" ALTER COLUMN "price" SET DATA TYPE DECIMAL(12,2);
