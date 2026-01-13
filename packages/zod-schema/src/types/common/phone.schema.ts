import { z } from "zod";

export const phoneSchema = z
  .string()
  .regex(/^[6-9]\d{9}$/, "Invalid Indian phone number");


export const optionalPhoneSchema = phoneSchema.optional();