import { z } from "zod";
import { optionalPriceSchema, priceSchema, stockSchema, slugSchema, uuidSchema } from "./common";

const productBaseSchema = z.object({
    name: z.string()
        .min(2, "Product name must be at least 2 characters")
        .max(200, "Product name must be at most 200 characters"),

    slug: slugSchema,

    description: z.string()
        .max(2000, "Description must be at most 2000 characters")
        .optional(),

    longDescription: z.string()
        .max(50000, "Long description is too long")
        .optional(),

    price: priceSchema,

    salePrice: optionalPriceSchema,

    // Purchase cost per unit — optional; used for exact P&L, falls back to an estimate when null.
    costPrice: optionalPriceSchema,

    isOnSale: z.boolean()
        .optional()
        .default(false),

    priceDisplay: z.enum(["BOTH", "REGULAR", "SALE"])
        .optional()
        .default("BOTH"),

    quantity: stockSchema.default(0),

    inStock: z.boolean()
        .optional()
        .default(true),

    categoryId: uuidSchema,

    specifications: z.array(
        z.object({
            label: z.string().trim().min(1, "Label is required").max(100, "Label is too long"),
            value: z.string().trim().min(1, "Value is required").max(500, "Value is too long"),
        })
    ).max(50, "Too many specification rows").optional(),

    preOrderEnabled: z.boolean().optional().default(false),
    bookingAmount: optionalPriceSchema,
    preOrderLimit: z.coerce.number().int().positive().optional(),
    preOrderNote: z.string().max(200).optional(),

    // Partial payment (deposit now, balance at delivery). The product switch is the
    // master; a null depositPercent inherits the store-wide default.
    partialPaymentEnabled: z.boolean().optional().default(false),
    depositPercent: z.coerce.number().min(1).max(99).nullish(),

    // ── SEO overrides (admin SEO panel; fall back to generated metadata) ──
    metaTitle: z.string().max(70, "Keep the SEO title under ~70 characters").optional(),
    metaDescription: z.string().max(160, "Keep the meta description under ~160 characters").optional(),
    ogImage: z.union([z.string().url("Must be a valid URL").max(2048), z.literal("")]).optional(),
    noindex: z.boolean().optional(),

    // ── Merchant / product identity (Google Shopping + Product JSON-LD) ──
    brand: z.string().max(100).optional(),
    gtin: z.string().max(50).optional(),
    mpn: z.string().max(70).optional(),
    condition: z.enum(["new", "used", "refurbished"]).optional(),
});

const refineSalePrice = (
    data: { price?: number; salePrice?: number; isOnSale?: boolean; priceDisplay?: string; preOrderEnabled?: boolean; bookingAmount?: number },
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
    if (data.preOrderEnabled && (data.bookingAmount == null || data.bookingAmount <= 0)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["bookingAmount"],
            message: "Set a booking amount to enable pre-orders",
        });
    }
    if (data.bookingAmount != null) {
        // Validate against the price the customer is actually charged (sale price when on sale),
        // so the booking can never meet/exceed what they'd pay — which would break the balance.
        const effectivePrice =
            data.isOnSale && data.salePrice != null ? data.salePrice : data.price;
        if (effectivePrice != null && data.bookingAmount >= effectivePrice) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["bookingAmount"],
                message: "Booking amount must be less than the (sale) price",
            });
        }
    }
};

export const createProductSchema = productBaseSchema.superRefine(refineSalePrice);

export const updateProductSchema = productBaseSchema.partial().superRefine(refineSalePrice);


export type CreateProductData = z.infer<typeof createProductSchema>;
export type UpdateProductData = z.infer<typeof updateProductSchema>;
