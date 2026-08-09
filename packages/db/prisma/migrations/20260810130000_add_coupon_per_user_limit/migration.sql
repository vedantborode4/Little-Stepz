-- Per-customer coupon usage cap. Only a global usageLimit existed, so one customer
-- could redeem the same coupon repeatedly. Nullable = unlimited per user, which
-- preserves the behaviour of every coupon that already exists.
ALTER TABLE "Coupon" ADD COLUMN "perUserLimit" INTEGER;

-- Counting a customer's redemptions reads Order(userId, couponId); no redemption
-- table is needed because Order already records both.
CREATE INDEX IF NOT EXISTS "Order_couponId_userId_idx" ON "Order"("couponId", "userId");
