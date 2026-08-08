// Enum value -> human label + badge color, mirroring the web status palettes.

/**
 * A badge's colour is now a *name*, not a pair of hex values. The concrete hues
 * are resolved per colour scheme inside `Badge` (components/ui/Badge.tsx).
 *
 * The old map baked in one light-mode palette and Badge applied it via an inline
 * style, which no CSS variable could flip — so every status chip stayed a bright
 * pastel block in dark mode. Light-mode values are unchanged.
 */
export type BadgeColor = "gray" | "blue" | "indigo" | "amber" | "green" | "red" | "purple" | "teal";

const palette = {
  gray: "gray",
  blue: "blue",
  indigo: "indigo",
  amber: "amber",
  green: "green",
  red: "red",
  purple: "purple",
  teal: "teal",
} satisfies Record<string, BadgeColor>;

export const ORDER_STATUS: Record<string, { label: string; color: BadgeColor }> = {
  PENDING: { label: "Pending", color: palette.amber },
  CONFIRMED: { label: "Confirmed", color: palette.blue },
  PROCESSING: { label: "Processing", color: palette.blue },
  SHIPPED: { label: "Shipped", color: palette.indigo },
  OUT_FOR_DELIVERY: { label: "Out for delivery", color: palette.indigo },
  DELIVERED: { label: "Delivered", color: palette.green },
  CANCELLED: { label: "Cancelled", color: palette.red },
  RETURN_REQUESTED: { label: "Return requested", color: palette.amber },
  RETURN_APPROVED: { label: "Return approved", color: palette.teal },
  RETURN_REJECTED: { label: "Return rejected", color: palette.red },
  RETURNED: { label: "Returned", color: palette.gray },
  REFUND_INITIATED: { label: "Refund initiated", color: palette.purple },
  REFUNDED: { label: "Refunded", color: palette.purple },
};

export const PAYMENT_STATUS: Record<string, { label: string; color: BadgeColor }> = {
  PENDING: { label: "Pending", color: palette.amber },
  INITIATED: { label: "Initiated", color: palette.blue },
  SUCCESS: { label: "Paid", color: palette.green },
  FAILED: { label: "Failed", color: palette.red },
  REFUND_INITIATED: { label: "Refund initiated", color: palette.purple },
  REFUNDED: { label: "Refunded", color: palette.purple },
  PARTIALLY_REFUNDED: { label: "Partially refunded", color: palette.purple },
};

export const AFFILIATE_STATUS: Record<string, { label: string; color: BadgeColor }> = {
  PENDING: { label: "Pending", color: palette.amber },
  APPROVED: { label: "Approved", color: palette.green },
  REJECTED: { label: "Rejected", color: palette.red },
};

export const COMMISSION_STATUS: Record<string, { label: string; color: BadgeColor }> = {
  PENDING: { label: "Pending", color: palette.amber },
  APPROVED: { label: "Approved", color: palette.blue },
  PAID: { label: "Paid", color: palette.green },
  CANCELLED: { label: "Cancelled", color: palette.red },
};

export const WITHDRAWAL_STATUS: Record<string, { label: string; color: BadgeColor }> = {
  PENDING: { label: "Pending", color: palette.amber },
  PROCESSING: { label: "Processing", color: palette.blue },
  PAID: { label: "Paid", color: palette.green },
  REJECTED: { label: "Rejected", color: palette.red },
};

export const ORDER_STATUS_VALUES = Object.keys(ORDER_STATUS);

export const COUPON_TYPES = ["PERCENTAGE", "FIXED_AMOUNT"] as const;
export const BANNER_POSITIONS = [
  "HOME_HERO",
  "HOME_MID",
  "CATEGORY_TOP",
  "PRODUCT_SIDEBAR",
  "CHECKOUT_TOP",
] as const;
export const PAYMENT_METHODS = ["ONLINE", "COD"] as const;

export function badgeFor(
  map: Record<string, { label: string; color: BadgeColor }>,
  value: string | null | undefined
): { label: string; color: BadgeColor } {
  if (value && map[value]) return map[value];
  return { label: value ?? "—", color: "gray" };
}
