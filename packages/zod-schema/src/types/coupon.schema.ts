import { z } from "zod";
import { booleanSchema, dateSchema, optionalDateSchema, uuidSchema } from "./common";

export const validateCouponBodySchema = z.object({ 
    code: z.string()
        .nonempty("Coupon code is required")
        .max(50, "Coupon code must be at most 50 characters"),

    orderAmount: z.number().positive("Order amount is required")
});


export const createCouponBodySchema = z.object({
    code: z.string()
        .min(1, "Coupon code is required")
        .max(50, "Coupon code must be at most 50 characters"),

    type: z.enum(["PERCENTAGE", "FIXED_AMOUNT"], {
        message: "Coupon type must be PERCENTAGE or FIXED_AMOUNT",
    }),
    value: z.number()
        .positive("Coupon value must be greater than 0"),

    minOrderValue: z.number()
        .positive("Minimum order value must be greater than 0")
        .optional(),

    maxDiscount: z.number()
        .positive("Max discount must be greater than 0")
        .optional(),

    usageLimit: z.number()
        .int("Usage limit must be an integer")
        .positive("Usage limit must be greater than 0")
        .optional(),

    validFrom: optionalDateSchema,
    validUntil: optionalDateSchema,

    isActive: booleanSchema.default(true),
    
});

export const updateCouponBodySchema = createCouponBodySchema.partial();

export const couponParamsSchema = z.object({ 
    id: uuidSchema
});



export type ValidateCouponBody = z.infer<typeof validateCouponBodySchema>;
export type CreateCouponBody = z.infer<typeof createCouponBodySchema>;
export type UpdateCouponBody = z.infer<typeof updateCouponBodySchema>;
export type CouponParams = z.infer<typeof couponParamsSchema>;
