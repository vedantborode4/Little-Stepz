-- Viral Products: admin-curated Instagram reels for the home page, each linked to products.
-- Additive only.

-- CreateTable
CREATE TABLE "ViralReel" (
    "id" TEXT NOT NULL,
    "reelUrl" TEXT NOT NULL,
    "coverImageUrl" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ViralReel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViralReelProduct" (
    "reelId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ViralReelProduct_pkey" PRIMARY KEY ("reelId","productId")
);

-- CreateIndex
CREATE INDEX "ViralReel_isActive_deletedAt_sortOrder_idx" ON "ViralReel"("isActive", "deletedAt", "sortOrder");

-- CreateIndex
CREATE INDEX "ViralReelProduct_productId_idx" ON "ViralReelProduct"("productId");

-- AddForeignKey
ALTER TABLE "ViralReelProduct" ADD CONSTRAINT "ViralReelProduct_reelId_fkey" FOREIGN KEY ("reelId") REFERENCES "ViralReel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViralReelProduct" ADD CONSTRAINT "ViralReelProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

