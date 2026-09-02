import z from "zod";
import { priceSchema, stockSchema, uuidSchema } from "./common";

const variantBaseSchema = z.object({
    productId:uuidSchema,
    name: z.string().min(1).max(200),
    sku: z.string().trim().max(64).nullish(),
    sortOrder: z.coerce.number().int().min(0).optional(),
    isDefault: z.boolean().optional(),
    // Nullish, not just optional: the admin editor sends null for a cleared field,
    // and `undefined` means "leave unchanged". Rejecting null made a blank price or
    // sale price unsaveable — the very thing the controller comment flagged.
    price: priceSchema.nullish(),
    salePrice: priceSchema.nullish(),
    isOnSale: z.boolean().optional().default(false),
    stock: stockSchema.optional(),

    // Per-variant pre-order terms. The product switch is the master — this can only
    // opt a variant out — and a null bookingAmount inherits the product's.
    preOrderEnabled: z.boolean().optional(),
    bookingAmount: priceSchema.nullish(),
    preOrderLimit: z.coerce.number().int().min(1).nullish(),

    // Per-variant partial-payment terms, same inheritance rule: the product switch is
    // master so this can only opt a variant out, and a null percent inherits.
    partialPaymentEnabled: z.boolean().optional(),
    depositPercent: z.coerce.number().min(1).max(99).nullish(),
});

const refineVariantSalePrice = (
    data: { price?: number | null; salePrice?: number | null; isOnSale?: boolean },
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