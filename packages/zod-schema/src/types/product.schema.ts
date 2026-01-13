import { z } from "zod";
import { priceSchema, quantitySchema, slugSchema, uuidSchema } from "./common";

export const createProductSchema = z.object({
    name: z.string()
        .min(2, "Product name must be at least 2 characters")
        .max(150, "Product name must be at most 150 characters"),

    slug: slugSchema,

    description: z.string()
        .max(2000, "Description must be at most 2000 characters")
        .optional(),

    price: priceSchema,

    quantity: quantitySchema.default(0),

    inStock: z.boolean()
        .optional()
        .default(true),

    categoryId: uuidSchema
});



export const updateProductSchema = createProductSchema.partial();
