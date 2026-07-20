import { z } from "zod";
import { nameSchema, optionalUuidSchema, slugSchema } from "./common";

export const createCategorySchema = z.object({
  name: nameSchema,

  slug: slugSchema,

  description: z.string()
    .max(500, "Description must be at most 500 characters")
    .optional()
    .transform((val) => val?.trim()),

  image: z.string()
    .url("Image must be a valid URL")
    .max(2048, "Image URL is too long")
    .optional(),

  parentId: optionalUuidSchema,

  isActive: z.boolean().optional()
});



export const updateCategorySchema = createCategorySchema.partial();


export type CreateCategoryData = z.infer<typeof createCategorySchema>;
export type UpdateCategoryData = z.infer<typeof updateCategorySchema>;