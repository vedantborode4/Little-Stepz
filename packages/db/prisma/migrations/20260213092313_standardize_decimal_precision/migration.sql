/*
  Warnings:

  - You are about to alter the column `amount` on the `Commission` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `value` on the `Coupon` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `minOrderValue` on the `Coupon` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `maxDiscount` on the `Coupon` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `subtotal` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `discount` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `shippingCharges` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `total` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `amount` on the `Payment` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `refundAmount` on the `Payment` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `price` on the `Product` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `price` on the `Variant` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.

*/
-- AlterTable
ALTER TABLE "Commission" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Coupon" ALTER COLUMN "value" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "minOrderValue" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "maxDiscount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "discount" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "shippingCharges" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "refundAmount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "price" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Variant" ALTER COLUMN "price" SET DATA TYPE DECIMAL(12,2);
