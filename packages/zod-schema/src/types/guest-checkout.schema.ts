import { z } from "zod";
import { emailSchema, nameSchema, phoneSchema } from "./common";

/**
 * Guest checkout: a shopper who doesn't want an account gives their contact details and
 * proves the phone with an SMS code. The backend keeps a password-less account behind the
 * scenes so orders, COD limits and coupons work exactly as for a signed-in customer.
 */
export const guestCheckoutStartSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
});
export type GuestCheckoutStartInput = z.infer<typeof guestCheckoutStartSchema>;

export const guestCheckoutVerifySchema = z.object({
  email: emailSchema,
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code we sent you"),
});
export type GuestCheckoutVerifyInput = z.infer<typeof guestCheckoutVerifySchema>;

/** The private "View your order" link token (base64url, 43 chars for 32 random bytes). */
export const orderAccessTokenParamSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{32,64}$/, "Invalid order link"),
});

/**
 * Public order tracking: the 8-character order reference printed on emails, the website and
 * the app (the last 8 characters of the order id), plus the email or phone used on the order.
 */
export const trackOrderSchema = z.object({
  reference: z
    .string()
    .trim()
    .transform((v) => v.replace(/^#/, "").toLowerCase())
    .pipe(z.string().regex(/^[0-9a-f]{8}$/, "Enter the 8-character order number from your email")),
  contact: z
    .string()
    .trim()
    .min(1, "Enter the email or phone number used on the order")
    .max(255)
    .transform((v) => (/^\+?91?[6-9]\d{9}$/.test(v.replace(/[\s-]/g, "")) ? v.replace(/[\s-]/g, "").slice(-10) : v.toLowerCase())),
});
export type TrackOrderInput = z.infer<typeof trackOrderSchema>;

/** The customer-facing order number: the last 8 characters of the order id, upper-cased. */
export const orderReference = (orderId: string): string => orderId.slice(-8).toUpperCase();
