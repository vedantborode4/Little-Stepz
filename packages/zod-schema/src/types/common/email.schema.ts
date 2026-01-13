import { z } from "zod";

export const emailSchema = z
  .string()
  .email()
  .max(255)
  .transform((val) => val.toLowerCase().trim());
