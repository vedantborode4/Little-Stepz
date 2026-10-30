-- CreateEnum
CREATE TYPE "public"."ImportKind" AS ENUM ('PRODUCTS', 'OPENING_STOCK', 'CUSTOMERS');

-- CreateEnum
CREATE TYPE "public"."ImportBatchStatus" AS ENUM ('UPLOADED', 'VALIDATED', 'IMPORTED', 'ROLLED_BACK', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ImportRowStatus" AS ENUM ('PENDING', 'VALID', 'ERROR', 'DUPLICATE', 'IMPORTED');

-- CreateEnum
CREATE TYPE "public"."SyncSource" AS ENUM ('MOCK', 'LIVE');

-- CreateEnum
CREATE TYPE "public"."SyncMode" AS ENUM ('DRY_RUN', 'LINK_IDS');

-- CreateEnum
CREATE TYPE "public"."SyncRunStatus" AS ENUM ('SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "public"."ImportTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "public"."ImportKind" NOT NULL,
    "mapping" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ImportBatch" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "public"."ImportKind" NOT NULL,
    "status" "public"."ImportBatchStatus" NOT NULL DEFAULT 'UPLOADED',
    "fileName" TEXT NOT NULL,
    "headers" JSONB NOT NULL,
    "mapping" JSONB,
    "locationId" TEXT,
    "totalRows" INTEGER NOT NULL,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "stockDocumentId" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rolledBackById" TEXT,
    "rolledBackAt" TIMESTAMP(3),
    "rollbackReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ImportRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "raw" JSONB NOT NULL,
    "mapped" JSONB,
    "status" "public"."ImportRowStatus" NOT NULL DEFAULT 'PENDING',
    "errors" JSONB,
    "duplicateOf" TEXT,
    "createdEntity" TEXT,
    "createdEntityId" TEXT,

    CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SyncRun" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "source" "public"."SyncSource" NOT NULL,
    "mode" "public"."SyncMode" NOT NULL,
    "status" "public"."SyncRunStatus" NOT NULL,
    "summary" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdById" TEXT,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImportTemplate_kind_name_key" ON "public"."ImportTemplate"("kind", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_code_key" ON "public"."ImportBatch"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_stockDocumentId_key" ON "public"."ImportBatch"("stockDocumentId");

-- CreateIndex
CREATE INDEX "ImportBatch_kind_createdAt_idx" ON "public"."ImportBatch"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "ImportRow_batchId_status_idx" ON "public"."ImportRow"("batchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ImportRow_batchId_rowNumber_key" ON "public"."ImportRow"("batchId", "rowNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SyncRun_code_key" ON "public"."SyncRun"("code");

-- CreateIndex
CREATE INDEX "SyncRun_startedAt_idx" ON "public"."SyncRun"("startedAt");

-- AddForeignKey
ALTER TABLE "public"."ImportTemplate" ADD CONSTRAINT "ImportTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImportBatch" ADD CONSTRAINT "ImportBatch_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImportBatch" ADD CONSTRAINT "ImportBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImportBatch" ADD CONSTRAINT "ImportBatch_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImportBatch" ADD CONSTRAINT "ImportBatch_rolledBackById_fkey" FOREIGN KEY ("rolledBackById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImportRow" ADD CONSTRAINT "ImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "public"."ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SyncRun" ADD CONSTRAINT "SyncRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Import history is kept: batches and rows are never deleted (rollback is a status, not a delete).
CREATE TRIGGER "ImportBatch_no_delete"
  BEFORE DELETE ON "ImportBatch"
  FOR EACH ROW EXECUTE FUNCTION crm_reject_mutation();
CREATE TRIGGER "ImportRow_no_delete"
  BEFORE DELETE ON "ImportRow"
  FOR EACH ROW EXECUTE FUNCTION crm_reject_mutation();

-- A sync run is written once, when it finishes.
CREATE TRIGGER "SyncRun_append_only_row"
  BEFORE UPDATE OR DELETE ON "SyncRun"
  FOR EACH ROW EXECUTE FUNCTION crm_reject_mutation();

ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_counts_nonnegative"
  CHECK ("totalRows" >= 0 AND "validRows" >= 0 AND "errorRows" >= 0 AND "duplicateRows" >= 0 AND "importedRows" >= 0);
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_opening_has_location"
  CHECK ("kind" <> 'OPENING_STOCK' OR "locationId" IS NOT NULL);
