import z from "zod";
import { optionalPriceSchema, priceSchema, stockSchema, uuidSchema } from "./common";

const variantBaseSchema = z.object({
    productId:uuidSchema,
    name: z.string().min(1).max(200),
    sku: z.string().trim().max(64).nullish(),
    sortOrder: z.coerce.number().int().min(0).optional(),
    isDefault: z.boolean().optional(),
    price: priceSchema.optional(),
    salePrice: optionalPriceSchema,
    isOnSale: z.boolean().optional().default(false),
    stock: stockSchema.optional(),
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
    // A variant sale only takes effect when the variant also sets its own regular
    // price (the charged-price resolver keys off variant.price). Without it the
    // sale would be silently ignored, so require the regular price up front.
    if ((data.isOnSale || data.salePrice != null) && data.price == null) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["price"],
            message: "Set the variant's regular price to use its own sale price",
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