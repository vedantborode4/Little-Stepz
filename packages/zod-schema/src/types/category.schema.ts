import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string()
    .min(2, "Category name must be at least 2 characters")
    .max(100, "Category name must be at most 100 characters")
    .transform((val) => val.trim()),

  slug: z.string()
    .min(2, "Slug must be at least 2 characters")
    .max(100, "Slug must be at most 100 characters")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase, alphanumeric, and hyphen-separated")
    .transform((val) => val.trim()),

  description: z.string()
    .max(500, "Description must be at most 500 characters")
    .optional()
    .transform((val) => val?.trim()),

  parentId: z.string()
    .uuid("parentId must be a valid UUID")
    .optional(),
});



export const updateCategorySchema = createCategorySchema.partial();