-- CreateEnum
CREATE TYPE "PriceDisplay" AS ENUM ('BOTH', 'REGULAR', 'SALE');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "salePrice" DECIMAL(12,2),
ADD COLUMN     "isOnSale" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priceDisplay" "PriceDisplay" NOT NULL DEFAULT 'BOTH';

-- AlterTable
ALTER TABLE "Variant" ADD COLUMN     "salePrice" DECIMAL(12,2),
ADD COLUMN     "isOnSale" BOOLEAN NOT NULL DEFAULT false;
