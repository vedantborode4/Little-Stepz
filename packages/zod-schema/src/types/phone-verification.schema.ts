import { z } from "zod";
import { phoneSchema } from "./common/phone.schema";

/**
 * Phone verification targets `Address.phone` — the number the courier actually
 * calls — not `User.phone`.
 *
 * `phoneSchema` stays bare-10-digit on purpose: it is load-bearing in
 * `createAddressSchema`, `updateProfileSchema` and `SignupSchema`, every stored
 * `Address.phone` is in that form, and it is what reaches Delhivery. The country
 * code is a transport concern and lives in the SMS adapter instead. It also happens
 * to be an abuse control — `^[6-9]\d{9}$` cannot express a premium-rate or
 * international destination.
 */
export const sendPhoneOtpSchema = z.object({
  phone: phoneSchema,
});

export const verifyPhoneOtpSchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code we sent you"),
});

export type SendPhoneOtpData = z.infer<typeof sendPhoneOtpSchema>;
export type VerifyPhoneOtpData = z.infer<typeof verifyPhoneOtpSchema>;
