import { z } from "zod";

export const priceSchema = z.coerce
  .number()
  .positive({ message: "Amount must be greater than 0" })
  .refine((val) => Number.isFinite(val), {
    message: "Invalid price value",
});

export const optionalPriceSchema = priceSchema.optional();
