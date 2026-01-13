import { z } from "zod";

export const createAddressSchema = z.object({
  name: z.string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be at most 50 characters")
    .transform((val) => val.trim()),

  phone: z.string()
    .regex(/^\+?\d{10,15}$/, "Phone must be 10-15 digits, optional +country code")
    .transform((val) => val.trim()),

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

  isDefault: z.boolean().optional().default(false),
});



export const updateAddressSchema = createAddressSchema.partial();
