import { z } from "zod";
import { booleanSchema, nameSchema, phoneSchema } from "./common";

export const createAddressSchema = z.object({
  name: nameSchema,

  phone: phoneSchema,

  address: z.string()
    .min(5, "Address must be at least 5 characters")
    .max(255, "Address must be at most 255 characters")
    .transform((val) => val.trim()),

  city: z.string()
    .min(2, "City must be at least 2 characters")
    .max(100, "City must be at most 100 characters")
    .transform((val) => val.trim()),

  state: z.string()
    .min(2, "State must be at least 2 characters")
    .max(100, "State must be at most 100 characters")
    .transform((val) => val.trim()),

  pincode: z.string()
    .regex(/^\d{4,10}$/, "Pincode must be 4-10 digits")
    .transform((val) => val.trim()),

  country: z.string()
    .max(50, "Country must be at most 50 characters")
    .default("India")
    .transform((val) => val.trim()),

  isDefault: booleanSchema.optional().default(false),
});



export const updateAddressSchema = createAddressSchema.partial();


export type AddressData = z.infer<typeof createAddressSchema>;
export type UpdateAddressData = z.infer<typeof updateAddressSchema>;