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
