import { prisma } from "@repo/db/client";
import { ApiError } from "../utils/api";
import { PhoneErrorCode } from "../utils/phoneErrors";
import { timingSafeEqualHex } from "../utils/auth/tokenHash";
import {
  generatePhoneOtp,
  hashOtpCode,
  MAX_CHALLENGES_PER_USER_PER_DAY,
  MAX_PHONE_OTP_ATTEMPTS,
  MAX_PHONE_OTP_SENDS,
  MAX_SENDS_PER_PHONE_PER_DAY,
  MAX_SENDS_PER_USER_PER_DAY,
  PHONE_OTP_RESEND_COOLDOWN_SECONDS,
  PHONE_OTP_TTL_MINUTES,
  SMS_DAILY_GLOBAL_CAP,
} from "../utils/auth/phone-otp";
import { buildPhoneOtpMessage, maskPhone, sendSms } from "../utils/sms";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RequestPhoneOtpResult {
  alreadyVerified: boolean;
  expiresInSeconds?: number;
  resendAfterSeconds?: number;
  sendsRemaining?: number;
}

/**
 * Send (or re-send) a phone verification code.
 *
 * There is deliberately no separate /resend endpoint: a live challenge is REUSED —
 * same code, `sendCount` incremented, `expiresAt` never extended, `attempts` carried
 * across. Minting a fresh challenge on every press would let a user reset their
 * attempt counter and earn a new send budget just by pressing "send" again.
 */
export async function requestPhoneOtpService(
  userId: string,
  phone: string,
  meta?: { ipAddress?: string; userAgent?: string }
): Promise<RequestPhoneOtpResult> {
  // Already proved — send nothing. A double-submitting client must not cost money.
  const existingVerified = await prisma.verifiedPhone.findUnique({
    where: { userId_phone: { userId, phone } },
    select: { id: true },
  });
  if (existingVerified) return { alreadyVerified: true };

  const now = new Date();
  const dayAgo = new Date(now.getTime() - DAY_MS);

  // ── Caps run BEFORE the provider call: the vendor bills per call. ──────────
  const [userSends, userChallenges, phoneSends, globalSends] = await Promise.all([
    prisma.phoneOtpChallenge.aggregate({
      _sum: { sendCount: true },
      where: { userId, createdAt: { gte: dayAgo } },
    }),
    prisma.phoneOtpChallenge.count({ where: { userId, createdAt: { gte: dayAgo } } }),
    prisma.phoneOtpChallenge.aggregate({
      _sum: { sendCount: true },
      where: { phone, createdAt: { gte: dayAgo } },
    }),
    prisma.phoneOtpChallenge.aggregate({
      _sum: { sendCount: true },
      where: { createdAt: { gte: dayAgo } },
    }),
  ]);

  if ((globalSends._sum.sendCount ?? 0) >= SMS_DAILY_GLOBAL_CAP) {
    console.error("[phone-otp] global daily SMS cap reached — refusing further sends");
    throw new ApiError(429, PhoneErrorCode.OTP_DAILY_LIMIT);
  }
  if ((userSends._sum.sendCount ?? 0) >= MAX_SENDS_PER_USER_PER_DAY) {
    throw new ApiError(429, PhoneErrorCode.OTP_DAILY_LIMIT);
  }
  // User-independent, so extra accounts don't multiply it.
  if ((phoneSends._sum.sendCount ?? 0) >= MAX_SENDS_PER_PHONE_PER_DAY) {
    throw new ApiError(429, PhoneErrorCode.OTP_DAILY_LIMIT);
  }

  const live = await prisma.phoneOtpChallenge.findFirst({
    where: { userId, phone, usedAt: null, expiresAt: { gte: now } },
    orderBy: { createdAt: "desc" },
  });

  if (!live && userChallenges >= MAX_CHALLENGES_PER_USER_PER_DAY) {
    throw new ApiError(429, PhoneErrorCode.OTP_DAILY_LIMIT);
  }

  if (live) {
    const sinceLastSend = (now.getTime() - live.lastSentAt.getTime()) / 1000;
    if (sinceLastSend < PHONE_OTP_RESEND_COOLDOWN_SECONDS) {
      throw new ApiError(429, PhoneErrorCode.OTP_COOLDOWN);
    }
    if (live.sendCount >= MAX_PHONE_OTP_SENDS) {
      throw new ApiError(429, PhoneErrorCode.OTP_SEND_LIMIT);
    }
  }

  // Reuse the live challenge's code; only mint one when there isn't a live challenge.
  const otp = live ? null : generatePhoneOtp();
  const previousLastSentAt = live?.lastSentAt ?? null;

  // Write BEFORE sending, so a crash mid-flight can't strand a code the DB never saw.
  const challenge = live
    ? await prisma.phoneOtpChallenge.update({
        where: { id: live.id },
        data: { sendCount: { increment: 1 }, lastSentAt: now },
      })
    : await prisma.phoneOtpChallenge.create({
        data: {
          userId,
          phone,
          codeHash: otp!.codeHash,
          expiresAt: otp!.expiresAt,
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        },
      });

  // A resend can't re-derive the original plaintext (only its hash is stored), so the
  // reused-challenge path re-sends by minting a code only when there was none. To
  // keep "same code on resend" true we must therefore have the code in hand — which
  // is only the case for a fresh challenge. For a resend we rotate the stored hash
  // instead, preserving expiry and attempts, which keeps every abuse property while
  // still delivering a code the user can actually type.
  let codeToSend: string;
  if (otp) {
    codeToSend = otp.code;
  } else {
    const rotated = generatePhoneOtp();
    await prisma.phoneOtpChallenge.update({
      where: { id: challenge.id },
      // expiresAt is deliberately NOT extended, and attempts carry across.
      data: { codeHash: rotated.codeHash },
    });
    codeToSend = rotated.code;
  }

  const result = await sendSms(
    buildPhoneOtpMessage(phone, codeToSend, PHONE_OTP_TTL_MINUTES)
  );

  if (!result.ok) {
    // A provider outage must not consume the user's cooldown or send budget.
    if (!live) {
      await prisma.phoneOtpChallenge.delete({ where: { id: challenge.id } }).catch(() => {});
    } else {
      await prisma.phoneOtpChallenge
        .update({
          where: { id: challenge.id },
          data: { sendCount: { decrement: 1 }, lastSentAt: previousLastSentAt ?? now },
        })
        .catch(() => {});
    }

    console.error(
      `[phone-otp] send failed for ${maskPhone(phone)}: ${result.errorCode ?? ""} ${result.error ?? ""}`
    );
    throw new ApiError(502, PhoneErrorCode.SMS_SEND_FAILED);
  }

  const sendCount = live ? live.sendCount + 1 : 1;

  return {
    alreadyVerified: false,
    expiresInSeconds: Math.max(
      0,
      Math.floor((challenge.expiresAt.getTime() - now.getTime()) / 1000)
    ),
    resendAfterSeconds: PHONE_OTP_RESEND_COOLDOWN_SECONDS,
    sendsRemaining: Math.max(0, MAX_PHONE_OTP_SENDS - sendCount),
  };
}

export async function verifyPhoneOtpService(
  userId: string,
  phone: string,
  code: string
): Promise<{ phone: string; verifiedAt: Date }> {
  const challenge = await prisma.phoneOtpChallenge.findFirst({
    where: { userId, phone, usedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!challenge) throw new ApiError(400, PhoneErrorCode.OTP_INVALID);
  if (challenge.expiresAt < new Date()) throw new ApiError(400, PhoneErrorCode.OTP_EXPIRED);
  if (challenge.attempts >= MAX_PHONE_OTP_ATTEMPTS) {
    throw new ApiError(400, PhoneErrorCode.OTP_MAX_ATTEMPTS);
  }

  if (!timingSafeEqualHex(challenge.codeHash, hashOtpCode(code))) {
    await prisma.phoneOtpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    throw new ApiError(400, PhoneErrorCode.OTP_INVALID);
  }

  const verified = await prisma.$transaction(async (tx) => {
    await tx.phoneOtpChallenge.update({
      where: { id: challenge.id },
      data: { usedAt: new Date() },
    });

    // Upsert on the (userId, phone) unique — re-verifying is idempotent.
    return tx.verifiedPhone.upsert({
      where: { userId_phone: { userId, phone } },
      create: { userId, phone },
      update: { verifiedAt: new Date() },
    });
  });

  return { phone: verified.phone, verifiedAt: verified.verifiedAt };
}

export async function isPhoneVerified(userId: string, phone: string): Promise<boolean> {
  const row = await prisma.verifiedPhone.findUnique({
    where: { userId_phone: { userId, phone } },
    select: { id: true },
  });
  return row !== null;
}

export async function assertPhoneVerified(userId: string, phone: string): Promise<void> {
  if (!(await isPhoneVerified(userId, phone))) {
    throw new ApiError(400, PhoneErrorCode.PHONE_NOT_VERIFIED);
  }
}

export async function listVerifiedPhones(userId: string): Promise<string[]> {
  const rows = await prisma.verifiedPhone.findMany({
    where: { userId },
    select: { phone: true },
  });
  return rows.map((r) => r.phone);
}
