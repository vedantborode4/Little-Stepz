-- Email is proven before the User row exists: the submitted signup payload parks
-- here until the emailed 6-digit code is redeemed. Purely additive — no existing
-- table is touched, so this is safe to apply ahead of the code that uses it.
CREATE TABLE "PendingSignup" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "referralCode" TEXT,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sendCount" INTEGER NOT NULL DEFAULT 1,
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingSignup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PendingSignup_email_key" ON "PendingSignup"("email");

CREATE INDEX "PendingSignup_expiresAt_idx" ON "PendingSignup"("expiresAt");
