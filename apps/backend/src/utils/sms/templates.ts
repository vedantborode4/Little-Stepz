import type { SmsMessage } from "./types";

/**
 * Message bodies.
 *
 * The delivered text must match the DLT-registered template character-for-character;
 * a mismatch comes back as `024 invalid template or template mismatch`. So the body is
 * env-driven (`SMS_TEMPLATE_PHONE_OTP`) — the approved wording is pasted in without a
 * code change and can never drift from what DLT approved.
 *
 * `{code}` and `{minutes}` map to the template's {#var#} slots, in order. The
 * currently-registered template has only ONE variable (the code), which is why the
 * default below carries no {minutes} — the TTL is shown in the UI instead.
 */
const DEFAULT_PHONE_OTP_TEMPLATE =
  "{code} is your OTP for login verification. Do not share this OTP with anyone. - Rushanjan LLP";

export function renderPhoneOtpText(code: string, ttlMinutes: number): string {
  const template = process.env.SMS_TEMPLATE_PHONE_OTP || DEFAULT_PHONE_OTP_TEMPLATE;
  return template
    .replace(/\{code\}/g, code)
    .replace(/\{minutes\}/g, String(ttlMinutes));
}

export function buildPhoneOtpMessage(
  to: string,
  code: string,
  ttlMinutes: number
): SmsMessage {
  return {
    to,
    templateKey: "PHONE_OTP",
    // Ordered to match the {#var#} slots in the registered template.
    variables: { var1: code, var2: String(ttlMinutes) },
    text: renderPhoneOtpText(code, ttlMinutes),
  };
}
