-- Phone verification for the number the courier actually calls (Address.phone).
-- Purely additive: two new tables, no existing table is touched.

CREATE TABLE "VerifiedPhone" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerifiedPhone_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VerifiedPhone_userId_phone_key" ON "VerifiedPhone"("userId", "phone");
CREATE INDEX "VerifiedPhone_phone_idx" ON "VerifiedPhone"("phone");

CREATE TABLE "PhoneOtpChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sendCount" INTEGER NOT NULL DEFAULT 1,
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneOtpChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PhoneOtpChallenge_userId_phone_idx" ON "PhoneOtpChallenge"("userId", "phone");
CREATE INDEX "PhoneOtpChallenge_phone_createdAt_idx" ON "PhoneOtpChallenge"("phone", "createdAt");
CREATE INDEX "PhoneOtpChallenge_userId_createdAt_idx" ON "PhoneOtpChallenge"("userId", "createdAt");
CREATE INDEX "PhoneOtpChallenge_expiresAt_idx" ON "PhoneOtpChallenge"("expiresAt");

ALTER TABLE "VerifiedPhone" ADD CONSTRAINT "VerifiedPhone_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PhoneOtpChallenge" ADD CONSTRAINT "PhoneOtpChallenge_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
