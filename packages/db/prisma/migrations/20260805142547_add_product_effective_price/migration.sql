-- The price a customer actually pays: the sale price when the product is on sale,
-- otherwise the regular price. Postgres maintains it, so it can never drift out of
-- sync with price / salePrice / isOnSale the way a denormalized column would, and it
-- stays indexable — which keeps "sort by price" a real indexed ORDER BY instead of an
-- in-memory sort that would break pagination.
--
-- Prisma cannot model generated columns: the field is mapped as an optional Decimal
-- and must NEVER be written to. A regenerated migration will show drift here (it will
-- want to strip the GENERATED clause) — review before applying, same as the partial
-- unique index on Variant.
ALTER TABLE "Product"
  ADD COLUMN "effectivePrice" DECIMAL(12,2)
  GENERATED ALWAYS AS (
    CASE WHEN "isOnSale" AND "salePrice" IS NOT NULL THEN "salePrice" ELSE "price" END
  ) STORED;

-- CreateIndex
CREATE INDEX "Product_effectivePrice_idx" ON "Product"("effectivePrice");
