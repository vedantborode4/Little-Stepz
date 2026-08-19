import { createHmac, randomInt } from "crypto";

export const PHONE_OTP_TTL_MINUTES = Number(process.env.PHONE_OTP_TTL_MINUTES) || 10;

/** Per-challenge brute-force cap. */
export const MAX_PHONE_OTP_ATTEMPTS = 5;

/** Sends allowed against one challenge before a new one is required. */
export const MAX_PHONE_OTP_SENDS = Number(process.env.MAX_PHONE_OTP_SENDS) || 3;

export const PHONE_OTP_RESEND_COOLDOWN_SECONDS =
  Number(process.env.PHONE_OTP_RESEND_COOLDOWN_SECONDS) || 60;

/** Rolling 24h caps. These, not the IP limiters, are what actually bound the bill. */
export const MAX_SENDS_PER_USER_PER_DAY = Number(process.env.MAX_SMS_PER_USER_DAY) || 10;
export const MAX_CHALLENGES_PER_USER_PER_DAY = Number(process.env.MAX_SMS_CHALLENGES_USER_DAY) || 5;
/** Cross-user: stops one number being SMS-bombed from many accounts. */
export const MAX_SENDS_PER_PHONE_PER_DAY = Number(process.env.MAX_SMS_PER_PHONE_DAY) || 5;
/** Hard circuit breaker on total daily spend. */
export const SMS_DAILY_GLOBAL_CAP = Number(process.env.SMS_DAILY_GLOBAL_CAP) || 500;

/**
 * HMAC rather than the bare sha256 `hashToken` used for password-reset codes.
 *
 * A 6-digit code has only 10^6 preimages — trivially reversible from a DB dump.
 * Password reset gets away with a plain hash because the code is paired with an
 * opaque emailed token; here there is no second factor, so the hash is keyed.
 *
 * Deliberately NOT retro-applied to PasswordResetToken: that would invalidate every
 * outstanding reset code.
 */
export function hashOtpCode(code: string): string {
  const pepper = process.env.OTP_HASH_SECRET ?? process.env.ACCESS_TOKEN_SECRET;
  if (!pepper) throw new Error("OTP_HASH_SECRET / ACCESS_TOKEN_SECRET is not set");
  return createHmac("sha256", pepper).update(code).digest("hex");
}

export interface GeneratedPhoneOtp {
  code: string;
  codeHash: string;
  expiresAt: Date;
}

export function generatePhoneOtp(): GeneratedPhoneOtp {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  return {
    code,
    codeHash: hashOtpCode(code),
    expiresAt: new Date(Date.now() + PHONE_OTP_TTL_MINUTES * 60 * 1000),
  };
}
