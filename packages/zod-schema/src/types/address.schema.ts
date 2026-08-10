import { z } from "zod";
import { booleanSchema, nameSchema, phoneSchema } from "./common";

export const createAddressSchema = z.object({
  name: nameSchema,

  phone: phoneSchema,

  // Street lines legitimately contain digits and , . - / # ( ) & ' — anything
  // outside that is not part of an Indian postal address and was previously
  // accepted verbatim, including characters that break labels and invoices.
  address: z.string()
    .trim()
    .min(5, "Address must be at least 5 characters")
    .max(255, "Address must be at most 255 characters")
    .regex(
      /^[A-Za-z0-9\s,.\-/#()&']+$/,
      "Address can only contain letters, numbers, spaces and , . - / # ( ) & '"
    ),

  // Place names: letters, spaces and . - ' only (e.g. "Thiruvananthapuram",
  // "Navi Mumbai", "Puducherry", "St. Thomas Mount").
  city: z.string()
    .trim()
    .min(2, "City must be at least 2 characters")
    .max(100, "City must be at most 100 characters")
    .regex(/^[A-Za-z\s.\-']+$/, "City can only contain letters, spaces and . - '"),

  state: z.string()
    .trim()
    .min(2, "State must be at least 2 characters")
    .max(100, "State must be at most 100 characters")
    .regex(/^[A-Za-z\s.\-']+$/, "State can only contain letters, spaces and . - '"),

  // Indian PIN codes are exactly 6 digits and never start with 0. The previous
  // 4-10 digit rule accepted values Delhivery can never service, and the failure
  // only surfaced at checkout.
  pincode: z.string()
    .trim()
    .regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit PIN code"),

  country: z.string()
    .trim()
    .max(50, "Country must be at most 50 characters")
    .regex(/^[A-Za-z\s.\-']+$/, "Country can only contain letters, spaces and . - '")
    .default("India"),

  isDefault: booleanSchema.optional().default(false),
});



export const updateAddressSchema = createAddressSchema.partial();


export type AddressData = z.infer<typeof createAddressSchema>;
export type UpdateAddressData = z.infer<typeof updateAddressSchema>;