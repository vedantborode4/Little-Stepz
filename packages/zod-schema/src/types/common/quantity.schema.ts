import { z } from "zod";

export const quantitySchema = z
  .coerce.number()
  .int()
  .min(1, { message: "Quantity must be at least 1" })
  .max(1000, { message: "Quantity too large" });
