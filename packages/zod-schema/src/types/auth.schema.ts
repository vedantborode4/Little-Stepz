import z from "zod";
import { authHeaderSchema, emailSchema, nameSchema, optionalPhoneSchema, passwordSchema } from "./common";

export const SignupSchema = z.object({
  email:emailSchema,
  name: nameSchema,
  password: passwordSchema,
  phone:optionalPhoneSchema,
  referralCode: z.string()
    .max(20, "Referral code must be at most 20 characters")
    .optional()
});

export const SigninSchema = z.object({
  email: emailSchema,
  password: passwordSchema
});


export const logoutSchema = z.object({
  headers: authHeaderSchema,
});

export const GoogleAuthSchema = z.object({
  idToken: z.string().min(1, "Google ID token is required"),
  referralCode: z.string()
    .max(20, "Referral code must be at most 20 characters")
    .optional(),
});

/**
 * Apple returns the user's name ONLY on the very first authorization, and never
 * again — so the client forwards it alongside the identity token and the server
 * must persist it on account creation. The token itself carries no name claim.
 */
export const AppleAuthSchema = z.object({
  identityToken: z.string().min(1, "Apple identity token is required"),
  givenName: z.string().max(50).optional(),
  familyName: z.string().max(50).optional(),
  referralCode: z.string()
    .max(20, "Referral code must be at most 20 characters")
    .optional(),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const verifyResetCodeSchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your email"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: passwordSchema,
});

/**
 * Step 1 of signup. Identical payload to the old direct signup — which is exactly
 * what lets both clients keep their existing forms — but it parks on a PendingSignup
 * row instead of creating a User. Aliased rather than redefined so the two can never
 * drift apart.
 */
export const signupRequestOtpSchema = SignupSchema;

/** Step 2 — redeem the emailed code and create the account. */
export const verifySignupOtpSchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your email"),
});

export type SignupData = z.infer<typeof SignupSchema>;
export type SigninData = z.infer<typeof SigninSchema>;
export type LogoutData = z.infer<typeof logoutSchema>;
export type GoogleAuthData = z.infer<typeof GoogleAuthSchema>;
export type AppleAuthData = z.infer<typeof AppleAuthSchema>;
export type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;
export type VerifyResetCodeData = z.infer<typeof verifyResetCodeSchema>;
export type ResetPasswordData = z.infer<typeof resetPasswordSchema>;
export type SignupRequestOtpData = z.infer<typeof signupRequestOtpSchema>;
export type VerifySignupOtpData = z.infer<typeof verifySignupOtpSchema>;