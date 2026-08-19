import { randomInt } from "crypto";
import { hashToken } from "./tokenHash";

export const SIGNUP_OTP_TTL_MINUTES =
  Number(process.env.SIGNUP_OTP_TTL_MINUTES) || 15;

/** Five wrong codes burn the pending signup; the user must request a new one. */
export const MAX_SIGNUP_OTP_ATTEMPTS = 5;

/**
 * Cross-instance resend controls. The express-rate-limit store is in-memory and
 * per-process, so these DB-backed counters are the guard that actually holds.
 */
export const SIGNUP_OTP_RESEND_COOLDOWN_SECONDS =
  Number(process.env.SIGNUP_OTP_RESEND_COOLDOWN_SECONDS) || 60;
export const MAX_SIGNUP_OTP_SENDS =
  Number(process.env.MAX_SIGNUP_OTP_SENDS) || 5;

export interface GeneratedSignupOtp {
  code: string;
  codeHash: string;
  expiresAt: Date;
}

/**
 * Six digits, same shape as the password-reset code. There is no opaque token
 * alongside it: password reset needs one because the link is redeemed
 * unauthenticated, whereas here the email itself is the thing being proven and the
 * code is entered back in the tab that started the signup.
 */
export const generateSignupOtp = (): GeneratedSignupOtp => {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");

  return {
    code,
    codeHash: hashToken(code),
    expiresAt: new Date(Date.now() + SIGNUP_OTP_TTL_MINUTES * 60 * 1000),
  };
};
