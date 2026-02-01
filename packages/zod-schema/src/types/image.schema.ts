import { z } from "zod";
import { uuidSchema } from "./common";

export const addProductImageSchema = z.object({
    params: { productId: uuidSchema },
    body: z.object({
        url: z.string().url(),
        alt: z.string().max(200).optional(),
        sortOrder: z.number().int().min(0).optional(),
    }),
});


export const productImageParamsSchema = z.object({ 
    imageId: uuidSchema 
});


export const reorderImageBodySchema = z.object({
    sortOrder: z.number().int().min(0) 
});


export type AddProductImageData = z.infer<typeof addProductImageSchema>;
export type ProductImageParams = z.infer<typeof productImageParamsSchema>;
export type ReorderImageBody = z.infer<typeof reorderImageBodySchema>;