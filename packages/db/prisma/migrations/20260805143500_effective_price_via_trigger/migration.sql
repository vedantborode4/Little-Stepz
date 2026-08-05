-- Replaces the GENERATED ALWAYS version of "effectivePrice" added in the previous
-- migration. Prisma cannot model generated columns, so that version left `migrate dev`
-- permanently detecting drift and prompting to strip the GENERATED clause.
--
-- A plain column kept in sync by a trigger models cleanly in Prisma (it is just a
-- nullable Decimal), and Prisma does not diff triggers — so there is no drift, while
-- the value still can't fall out of sync with price / salePrice / isOnSale the way an
-- application-maintained column could. Being a real column, it stays indexable, which
-- keeps "sort by price" and the min/max price filter as indexed SQL rather than an
-- in-memory sort that would break pagination.

DROP INDEX IF EXISTS "Product_effectivePrice_idx";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "effectivePrice";
ALTER TABLE "Product" ADD COLUMN "effectivePrice" DECIMAL(12,2);

-- The price a customer actually pays: sale price when on sale, else regular price.
CREATE OR REPLACE FUNCTION product_set_effective_price() RETURNS trigger AS $$
BEGIN
  NEW."effectivePrice" := CASE
    WHEN NEW."isOnSale" AND NEW."salePrice" IS NOT NULL THEN NEW."salePrice"
    ELSE NEW."price"
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS product_effective_price_trg ON "Product";
CREATE TRIGGER product_effective_price_trg
  BEFORE INSERT OR UPDATE ON "Product"
  FOR EACH ROW EXECUTE FUNCTION product_set_effective_price();

-- Backfill existing rows (the trigger only covers writes from here on).
UPDATE "Product"
SET "effectivePrice" = CASE
  WHEN "isOnSale" AND "salePrice" IS NOT NULL THEN "salePrice"
  ELSE "price"
END;

-- CreateIndex
CREATE INDEX "Product_effectivePrice_idx" ON "Product"("effectivePrice");
