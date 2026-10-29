import { z } from "zod";
import { requiredText } from "./common";
import { ROLES } from "./enums";

export const PASSWORD_MIN_LENGTH = 10;

const newPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(128)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Use at least one letter and one number");

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email"));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Required").max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Required").max(128),
    newPassword,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    path: ["newPassword"],
    message: "New password must differ from the current one",
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const createUserSchema = z.object({
  name: requiredText(80),
  email,
  role: z.enum(ROLES),
  temporaryPassword: newPassword,
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    name: requiredText(80),
    role: z.enum(ROLES),
    isActive: z.boolean(),
  })
  .partial();
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const resetPasswordSchema = z.object({ temporaryPassword: newPassword });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
