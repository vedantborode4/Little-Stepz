-- Trigram matching for "similar name" duplicate checks (a trusted extension; no superuser needed).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "public"."CustomerType" AS ENUM ('RETAIL', 'WHOLESALE');

-- CreateTable
CREATE TABLE "public"."Customer" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "mobile" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "stateCode" TEXT,
    "pincode" TEXT,
    "type" "public"."CustomerType" NOT NULL DEFAULT 'RETAIL',
    "creditDays" INTEGER,
    "creditLimit" DECIMAL(14,2),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mergedIntoId" TEXT,
    "mergedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerPrice" (
    "customerId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerPrice_pkey" PRIMARY KEY ("customerId","variantId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_code_key" ON "public"."Customer"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_mobile_key" ON "public"."Customer"("mobile");

-- CreateIndex
CREATE INDEX "Customer_nameKey_idx" ON "public"."Customer" USING GIN ("nameKey" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Customer_pincode_idx" ON "public"."Customer"("pincode");

-- CreateIndex
CREATE INDEX "Customer_type_idx" ON "public"."Customer"("type");

-- CreateIndex
CREATE INDEX "CustomerPrice_variantId_idx" ON "public"."CustomerPrice"("variantId");

-- AddForeignKey
ALTER TABLE "public"."Customer" ADD CONSTRAINT "Customer_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "public"."Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerPrice" ADD CONSTRAINT "CustomerPrice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerPrice" ADD CONSTRAINT "CustomerPrice_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "public"."Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Customer" ADD CONSTRAINT "Customer_terms_valid" CHECK (
  ("creditDays" IS NULL OR "creditDays" BETWEEN 0 AND 365) AND ("creditLimit" IS NULL OR "creditLimit" >= 0)
);
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_not_merged_into_self" CHECK ("mergedIntoId" IS NULL OR "mergedIntoId" <> "id");
ALTER TABLE "CustomerPrice" ADD CONSTRAINT "CustomerPrice_positive" CHECK ("price" > 0);
