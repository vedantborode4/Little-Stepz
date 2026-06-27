import z from "zod";
import { optionalPriceSchema, priceSchema, quantitySchema, uuidSchema } from "./common";

const variantBaseSchema = z.object({
    productId:uuidSchema,
    name: z.string().min(1).max(100),
    price: priceSchema.optional(),
    salePrice: optionalPriceSchema,
    isOnSale: z.boolean().optional().default(false),
    stock: quantitySchema.optional(),
});

const refineVariantSalePrice = (
    data: { price?: number; salePrice?: number; isOnSale?: boolean },
    ctx: z.RefinementCtx
) => {
    if (data.salePrice != null && data.price != null && data.salePrice >= data.price) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["salePrice"],
            message: "Sale price must be less than the regular price",
        });
    }
    if (data.isOnSale && data.salePrice == null) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["salePrice"],
            message: "Set a sale price to put this variant on sale",
        });
    }
};

export const createVariantBodySchema = variantBaseSchema.superRefine(refineVariantSalePrice);

export const updateVariantBodySchema = variantBaseSchema.partial().superRefine(refineVariantSalePrice);
export const variantParamsSchema = z.object({ 
    id: uuidSchema 
});

export type CreateVariantBody = z.infer<typeof createVariantBodySchema>;
export type UpdateVariantBody = z.infer<typeof updateVariantBodySchema>;
export type VariantParams = z.infer<typeof variantParamsSchema>;