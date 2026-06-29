import { z } from "zod";

export const quantitySchema = z
  .coerce.number()
  .int()
  .min(1, { message: "Quantity must be at least 1" })
  .max(1000, { message: "Quantity too large" });

// Inventory on hand — may legitimately be 0 (out of stock / pre-order products).
export const stockSchema = z
  .coerce.number()
  .int()
  .min(0, { message: "Stock cannot be negative" })
  .max(1000000, { message: "Stock too large" });
