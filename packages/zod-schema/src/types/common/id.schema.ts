import { z } from "zod";

export const uuidSchema = z
  .string()
  .uuid({ message: "Invalid UUID format" });

export const optionalUuidSchema = uuidSchema.optional();
