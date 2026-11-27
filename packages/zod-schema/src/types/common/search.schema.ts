import { z } from "zod";

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(100),
});

/** Product search results. Without `page` the API returns only the top `limit` (older app builds rely on that). */
export const searchProductsQuerySchema = searchQuerySchema.extend({
  page: z.coerce.number().int().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
