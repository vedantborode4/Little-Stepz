import z from "zod";
import { optionalUuidSchema, uuidSchema } from "./common";

export const createReviewSchema = z.object({
    productId: uuidSchema,
    orderId: optionalUuidSchema,
    rating: z
        .number()
        .int()
        .min(1, "Rating must be at least 1")
        .max(5, "Rating cannot exceed 5"),
    comment: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .optional()
});

export const deleteReviewSchema = z.object({
    reviewId: uuidSchema,
})

export type CreateReviewData = z.infer<typeof createReviewSchema>;
export type DeleteReviewData = z.infer<typeof deleteReviewSchema>;