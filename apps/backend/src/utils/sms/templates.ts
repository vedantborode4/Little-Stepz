import type { SmsMessage } from "./types";

/**
 * Single source of truth for message bodies.
 *
 * This text must be byte-identical to what is registered on DLT, including the
 * trailing sender-ID suffix. A mismatch is not a visible error: the vendor API
 * returns success and the operator silently drops the SMS.
 *
 * Registered template (variables as {#var#}):
 *   Your Little Stepz verification code is {#var#}. Valid for {#var#} minutes.
 *   Do not share it with anyone. - LSTEPZ
 */
export function buildPhoneOtpMessage(
  to: string,
  code: string,
  ttlMinutes: number
): SmsMessage {
  const text =
    `Your Little Stepz verification code is ${code}. ` +
    `Valid for ${ttlMinutes} minutes. Do not share it with anyone. - LSTEPZ`;

  return {
    to,
    templateKey: "PHONE_OTP",
    variables: { var1: code, var2: String(ttlMinutes) },
    text,
  };
}
