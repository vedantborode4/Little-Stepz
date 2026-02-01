import z from "zod";
import { nameSchema, passwordSchema, phoneSchema } from "./common";

export const updateProfileSchema = z
    .object({
        name: nameSchema.optional(),
        phone: phoneSchema.optional(),
    })
    .refine(
        (data) => data.name || data.phone,
        {
        message: "At least one field must be provided",
        }
);

export const updatePasswordSchema = z
    .object({
        oldPassword: passwordSchema,
        newPassword: passwordSchema,
    })


export type UpdateProfileData = z.infer<typeof updateProfileSchema>;
export type UpdatePasswordData = z.infer<typeof updatePasswordSchema>;