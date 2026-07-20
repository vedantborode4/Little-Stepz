import { z } from "zod";
import { uuidSchema, paginationSchema, roleSchema } from "./common";

export const devicePlatformSchema = z.enum(["IOS", "ANDROID"]);

export const registerDeviceBodySchema = z
  .object({
    token: z.string().trim().min(1, "Push token is required"),
    platform: devicePlatformSchema,
    deviceName: z.string().trim().max(120).optional(),
  })
  .strict();

export const unregisterDeviceBodySchema = z
  .object({
    token: z.string().trim().min(1, "Push token is required"),
  })
  .strict();

export const notificationListQuerySchema = paginationSchema.extend({
  unreadOnly: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

export const notificationParamsSchema = z
  .object({
    id: uuidSchema,
  })
  .strict();

export const updatePreferencesBodySchema = z
  .object({
    pushEnabled: z.boolean().optional(),
    orderUpdates: z.boolean().optional(),
    paymentUpdates: z.boolean().optional(),
    affiliateUpdates: z.boolean().optional(),
    marketing: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one preference must be provided",
  });

export const broadcastTargetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ALL") }).strict(),
  z.object({ type: z.literal("ROLE"), role: roleSchema }).strict(),
  z.object({ type: z.literal("USER"), userId: uuidSchema }).strict(),
  z.object({ type: z.literal("PRODUCT_BUYERS"), productId: uuidSchema }).strict(),
  z.object({ type: z.literal("ORDER"), orderId: uuidSchema }).strict(),
]);

export const adminBroadcastBodySchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(120),
    body: z.string().trim().min(1, "Body is required").max(500),
    data: z.record(z.string(), z.any()).optional(),
    target: broadcastTargetSchema,
  })
  .strict();

export type DevicePlatform = z.infer<typeof devicePlatformSchema>;
export type RegisterDeviceBody = z.infer<typeof registerDeviceBodySchema>;
export type UnregisterDeviceBody = z.infer<typeof unregisterDeviceBodySchema>;
export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
export type NotificationParams = z.infer<typeof notificationParamsSchema>;
export type UpdatePreferencesBody = z.infer<typeof updatePreferencesBodySchema>;
export type BroadcastTarget = z.infer<typeof broadcastTargetSchema>;
export type AdminBroadcastBody = z.infer<typeof adminBroadcastBodySchema>;
