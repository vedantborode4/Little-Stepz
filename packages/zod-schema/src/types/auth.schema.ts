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

export type SignupData = z.infer<typeof SignupSchema>;
export type SigninData = z.infer<typeof SigninSchema>;
export type LogoutData = z.infer<typeof logoutSchema>;
export type GoogleAuthData = z.infer<typeof GoogleAuthSchema>;
export type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;
export type VerifyResetCodeData = z.infer<typeof verifyResetCodeSchema>;
export type ResetPasswordData = z.infer<typeof resetPasswordSchema>;