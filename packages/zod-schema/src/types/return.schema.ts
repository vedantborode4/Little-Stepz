import { z } from "zod";
import { uuidSchema, paginationSchema } from "./common";

export const RETURN_REASON_CODES = [
  "DAMAGED",
  "DEFECTIVE",
  "WRONG_ITEM",
  "MISSING_PARTS",
  "NOT_WORKING",
  "CHANGED_MIND",
  "OTHER",
] as const;

export type ReturnReasonCode = (typeof RETURN_REASON_CODES)[number];

/**
 * Reasons that point at the seller rather than the customer. They default the admin's
 * "refund shipping" toggle on, and are the only reasons a converted pre-order accepts.
 */
export const SELLER_FAULT_REASON_CODES: readonly ReturnReasonCode[] = [
  "DAMAGED",
  "DEFECTIVE",
  "WRONG_ITEM",
  "MISSING_PARTS",
  "NOT_WORKING",
];

export const RETURN_MAX_IMAGES = 5;
export const RETURN_MAX_VIDEOS = 1;

export const upiIdSchema = z
  .string()
  .trim()
  .max(256)
  .regex(/^[\w.-]{2,256}@[a-zA-Z]{2,64}$/, "Enter a valid UPI ID (e.g. name@bank)");

export const returnMediaSchema = z
  .object({
    url:      z.string().url().max(1000),
    publicId: z.string().min(1).max(300),
    type:     z.enum(["image", "video"]),
  })
  .strict();

export const returnItemSelectionSchema = z
  .object({
    orderItemId: uuidSchema,
    quantity:    z.number().int().min(1).max(1000),
  })
  .strict();

const returnItemsSchema = z
  .array(returnItemSelectionSchema)
  .min(1, "Select at least one item to return")
  .max(100)
  .refine(
    (items) => new Set(items.map((i) => i.orderItemId)).size === items.length,
    "Each item can only be selected once"
  );

export const quoteReturnBodySchema = z
  .object({ items: returnItemsSchema })
  .strict();

export const createItemReturnBodySchema = z
  .object({
    items:          returnItemsSchema,
    reasonCode:     z.enum(RETURN_REASON_CODES),
    description:    z.string().trim().max(2000).optional(),
    media:          z.array(returnMediaSchema).max(RETURN_MAX_IMAGES + RETURN_MAX_VIDEOS),
    refundUpiId:    upiIdSchema.optional(),
    idempotencyKey: uuidSchema,
  })
  .strict()
  .superRefine((body, ctx) => {
    if (body.reasonCode === "OTHER" && (body.description?.length ?? 0) < 10) {
      ctx.addIssue({
        code: "custom",
        path: ["description"],
        message: "Please describe the issue (at least 10 characters)",
      });
    }
    const images = body.media.filter((m) => m.type === "image").length;
    const videos = body.media.filter((m) => m.type === "video").length;
    if (images < 1) {
      ctx.addIssue({ code: "custom", path: ["media"], message: "Add at least one photo of the item" });
    }
    if (images > RETURN_MAX_IMAGES) {
      ctx.addIssue({ code: "custom", path: ["media"], message: `Up to ${RETURN_MAX_IMAGES} photos allowed` });
    }
    if (videos > RETURN_MAX_VIDEOS) {
      ctx.addIssue({ code: "custom", path: ["media"], message: "Only one video allowed" });
    }
  });

export const returnParamsSchema = z.object({ returnId: uuidSchema }).strict();

export const returnRefundParamsSchema = z.object({ id: uuidSchema }).strict();

// ── Admin ──────────────────────────────────────────────────────────────────────

export const adminReturnsQuerySchema = paginationSchema.extend({
  status: z
    .enum([
      "PENDING", "APPROVED", "REJECTED", "REFUNDED",
      "PICKED_UP", "RECEIVED", "INSPECTION_FAILED", "CANCELLED",
    ])
    .optional(),
});

export const scheduleReturnPickupBodySchema = z
  .object({ mode: z.enum(["MANUAL", "DELHIVERY"]) })
  .strict();

export const receiveReturnBodySchema = z
  .object({
    items: z
      .array(
        z
          .object({
            returnItemId:     uuidSchema,
            acceptedQuantity: z.number().int().min(0).max(1000),
            restock:          z.boolean(),
          })
          .strict()
      )
      .min(1),
    /** Lower than the computed maximum only; the server refuses anything above it. */
    refundAmount:   z.number().min(0).optional(),
    refundShipping: z.boolean(),
    inspectionNote: z.string().trim().max(1000).optional(),
  })
  .strict();

export const settleReturnRefundBodySchema = z
  .object({ reference: z.string().trim().min(3).max(200) })
  .strict();

export const retryReturnRefundBodySchema = z
  .object({
    /** The admin confirms Razorpay shows no refund for this row — refunds are not idempotent. */
    confirmNotRefunded: z.literal(true),
  })
  .strict();

export type QuoteReturnBody        = z.infer<typeof quoteReturnBodySchema>;
export type CreateItemReturnBody   = z.infer<typeof createItemReturnBodySchema>;
export type ReturnMedia            = z.infer<typeof returnMediaSchema>;
export type AdminReturnsQuery      = z.infer<typeof adminReturnsQuerySchema>;
export type ScheduleReturnPickupBody = z.infer<typeof scheduleReturnPickupBodySchema>;
export type ReceiveReturnBody      = z.infer<typeof receiveReturnBodySchema>;
export type SettleReturnRefundBody = z.infer<typeof settleReturnRefundBodySchema>;
