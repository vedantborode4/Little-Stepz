import { z } from "zod";
import { optionalPriceSchema, priceSchema, quantitySchema, slugSchema, uuidSchema } from "./common";

const productBaseSchema = z.object({
    name: z.string()
        .min(2, "Product name must be at least 2 characters")
        .max(150, "Product name must be at most 150 characters"),

    slug: slugSchema,

    description: z.string()
        .max(2000, "Description must be at most 2000 characters")
        .optional(),

    longDescription: z.string()
        .max(50000, "Long description is too long")
        .optional(),

    price: priceSchema,

    salePrice: optionalPriceSchema,

    isOnSale: z.boolean()
        .optional()
        .default(false),

    priceDisplay: z.enum(["BOTH", "REGULAR", "SALE"])
        .optional()
        .default("BOTH"),

    quantity: quantitySchema.default(0),

    inStock: z.boolean()
        .optional()
        .default(true),

    categoryId: uuidSchema
});

const refineSalePrice = (
    data: { price?: number; salePrice?: number; isOnSale?: boolean; priceDisplay?: string },
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
            message: "Set a sale price to put this product on sale",
        });
    }
    if (data.isOnSale && data.priceDisplay === "REGULAR") {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["priceDisplay"],
            message: "Cannot show only the regular price while the product is on sale",
        });
    }
};

export const createProductSchema = productBaseSchema.superRefine(refineSalePrice);

export const updateProductSchema = productBaseSchema.partial().superRefine(refineSalePrice);


export type CreateProductData = z.infer<typeof createProductSchema>;
export type UpdateProductData = z.infer<typeof updateProductSchema>;
