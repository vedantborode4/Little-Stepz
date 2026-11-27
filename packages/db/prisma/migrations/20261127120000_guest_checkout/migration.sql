-- Guest checkout: password-less "quiet" accounts and a private per-order link.
-- Additive only; existing rows get isGuest = false and no access token.

ALTER TABLE "User" ADD COLUMN "isGuest" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Order" ADD COLUMN "accessToken" TEXT;

CREATE UNIQUE INDEX "Order_accessToken_key" ON "Order"("accessToken");
