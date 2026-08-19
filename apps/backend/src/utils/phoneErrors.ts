/**
 * Machine-readable phone-verification errors.
 *
 * Both clients hide unrecognised SCREAMING_SNAKE codes behind a generic fallback
 * (`friendlyError` on web, `getErrorMessage` on mobile), so every code added here
 * MUST get copy in `apps/web/lib/errorMessages.ts` and
 * `apps/mobile/src/lib/utils/errors.ts` — otherwise the user just sees "Something
 * went wrong" and the feature is undebuggable.
 */
export enum PhoneErrorCode {
  PHONE_NOT_VERIFIED = "PHONE_NOT_VERIFIED",
  PHONE_ALREADY_VERIFIED = "PHONE_ALREADY_VERIFIED",
  OTP_INVALID = "OTP_INVALID",
  OTP_EXPIRED = "OTP_EXPIRED",
  OTP_MAX_ATTEMPTS = "OTP_MAX_ATTEMPTS",
  OTP_COOLDOWN = "OTP_COOLDOWN",
  OTP_SEND_LIMIT = "OTP_SEND_LIMIT",
  OTP_DAILY_LIMIT = "OTP_DAILY_LIMIT",
  OTP_RATE_LIMITED = "OTP_RATE_LIMITED",
  SMS_SEND_FAILED = "SMS_SEND_FAILED",
}
