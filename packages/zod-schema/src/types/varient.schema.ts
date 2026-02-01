import z from "zod";
import { priceSchema, quantitySchema, uuidSchema } from "./common";

export const createVariantBodySchema = z.object({
    productId:uuidSchema,
    name: z.string().min(1).max(100),
    price: priceSchema.optional(),
    stock: quantitySchema.optional(),
});

export const updateVariantBodySchema = createVariantBodySchema.partial();
export const variantParamsSchema = z.object({ 
    id: uuidSchema 
});

export type CreateVariantBody = z.infer<typeof createVariantBodySchema>;
export type UpdateVariantBody = z.infer<typeof updateVariantBodySchema>;
export type VariantParams = z.infer<typeof variantParamsSchema>;