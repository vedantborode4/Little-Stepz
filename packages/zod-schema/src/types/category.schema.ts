import { z } from "zod";
import { nameSchema, optionalUuidSchema, slugSchema } from "./common";

export const createCategorySchema = z.object({
  name: nameSchema,

  slug: slugSchema,

  description: z.string()
    .max(500, "Description must be at most 500 characters")
    .optional()
    .transform((val) => val?.trim()),

  parentId: optionalUuidSchema
});



export const updateCategorySchema = createCategorySchema.partial();