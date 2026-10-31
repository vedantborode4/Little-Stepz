-- CreateEnum
CREATE TYPE "public"."ProductImageSource" AS ENUM ('UPLOAD', 'LINK');

-- CreateTable
CREATE TABLE "public"."ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "url" TEXT NOT NULL,
    "publicId" TEXT,
    "source" "public"."ProductImageSource" NOT NULL,
    "position" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductImage_productId_position_idx" ON "public"."ProductImage"("productId", "position");

-- CreateIndex
CREATE INDEX "ProductImage_variantId_idx" ON "public"."ProductImage"("variantId");

-- AddForeignKey
ALTER TABLE "public"."ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductImage" ADD CONSTRAINT "ProductImage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "public"."Variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing single photos become the first photo of each gallery.
INSERT INTO "public"."ProductImage" ("id", "productId", "url", "source", "position")
SELECT gen_random_uuid()::text, "id", "imageUrl", 'LINK', 0
FROM "public"."Product"
WHERE "imageUrl" IS NOT NULL;
