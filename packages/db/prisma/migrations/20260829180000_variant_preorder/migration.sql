-- Per-variant pre-order terms. preOrderEnabled defaults to true so every existing
-- variant keeps inheriting its product's setting; bookingAmount NULL means inherit.
ALTER TABLE "Variant" ADD COLUMN "preOrderEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Variant" ADD COLUMN "bookingAmount" DECIMAL(12,2);
ALTER TABLE "Variant" ADD COLUMN "preOrderLimit" INTEGER;
ALTER TABLE "Variant" ADD COLUMN "preOrderCount" INTEGER NOT NULL DEFAULT 0;
