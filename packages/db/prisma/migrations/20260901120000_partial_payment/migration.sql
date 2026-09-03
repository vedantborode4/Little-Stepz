-- Partial payment: 20% deposit at checkout, balance collected at delivery.
--
-- Every Order/Payment column here is nullable with no default, or a constant-default
-- boolean. Both are catalog-only changes on PG11+, so this is instant on a live table
-- with no rewrite. Existing rows read as `paymentPlan = 'FULL'`, which is exactly the
-- current semantic, so nothing needs backfilling and every query that ignores these
-- columns behaves identically.

CREATE TYPE "PaymentPlan"   AS ENUM ('FULL', 'PARTIAL');
CREATE TYPE "BalanceMethod" AS ENUM ('ONLINE', 'COD', 'MANUAL');

-- Postgres appends new enum members, so 'PARTIALLY_PAID' sorts last. Nothing orders by
-- this type, and no existing row can hold the new value.
--
-- NOTE: Prisma wraps each migration in a transaction, and Postgres forbids *using* an
-- enum value added in the same transaction. Nothing below references 'PARTIALLY_PAID',
-- which is why this is safe here — do not add such a reference to this file.
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_PAID';

-- ── Order ───────────────────────────────────────────────────────────────────────
ALTER TABLE "Order" ADD COLUMN "paymentPlan" "PaymentPlan" NOT NULL DEFAULT 'FULL';
ALTER TABLE "Order" ADD COLUMN "depositAmount" DECIMAL(12,2);
ALTER TABLE "Order" ADD COLUMN "balanceAmount" DECIMAL(12,2);
ALTER TABLE "Order" ADD COLUMN "depositPaidAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "balanceToken" TEXT;
ALTER TABLE "Order" ADD COLUMN "dispatchLockedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "depositForfeitedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "depositForfeitReason" TEXT;

-- The conservation invariant, enforced by the database rather than by discipline:
-- deposit + balance must reconstruct the total to the paisa. A FULL order leaves both
-- NULL, so the predicate is scoped to PARTIAL rows.
ALTER TABLE "Order" ADD CONSTRAINT "order_partial_split_sums"
  CHECK (
    "paymentPlan" = 'FULL'
    OR ("depositAmount" IS NOT NULL
        AND "balanceAmount" IS NOT NULL
        AND "depositAmount" + "balanceAmount" = "total")
  );

-- Unique over a mostly-NULL column is correct in Postgres: NULLs never collide.
CREATE UNIQUE INDEX "Order_balanceToken_key" ON "Order"("balanceToken");
CREATE INDEX "Order_paymentPlan_idx" ON "Order"("paymentPlan");

-- ── Payment ─────────────────────────────────────────────────────────────────────
ALTER TABLE "Payment" ADD COLUMN "balanceAmount" DECIMAL(12,2);
ALTER TABLE "Payment" ADD COLUMN "balanceRazorpayOrderId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "balanceRazorpayPaymentId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "balancePaidAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN "balanceMethod" "BalanceMethod";
ALTER TABLE "Payment" ADD COLUMN "balanceSettledAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN "balanceReference" TEXT;
ALTER TABLE "Payment" ADD COLUMN "balanceAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN "balanceRefundId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "balanceRefundAmount" DECIMAL(12,2);
ALTER TABLE "Payment" ADD COLUMN "balanceRefundedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN "codRemittedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN "codRemittedAmount" DECIMAL(12,2);
ALTER TABLE "Payment" ADD COLUMN "manualRefundAmount" DECIMAL(12,2);
ALTER TABLE "Payment" ADD COLUMN "manualRefundSettledAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Payment_balanceRazorpayOrderId_key"   ON "Payment"("balanceRazorpayOrderId");
CREATE UNIQUE INDEX "Payment_balanceRazorpayPaymentId_key" ON "Payment"("balanceRazorpayPaymentId");
CREATE INDEX "Payment_balanceRazorpayOrderId_idx" ON "Payment"("balanceRazorpayOrderId");

-- ── Product / Variant terms ─────────────────────────────────────────────────────
-- Product defaults false so the migration opts nothing in; Variant defaults true so a
-- variant inherits its product and can only ever opt out. Mirrors preOrderEnabled.
ALTER TABLE "Product" ADD COLUMN "partialPaymentEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "depositPercent" DECIMAL(5,2);
ALTER TABLE "Variant" ADD COLUMN "partialPaymentEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Variant" ADD COLUMN "depositPercent" DECIMAL(5,2);
