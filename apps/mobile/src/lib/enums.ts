// Enum value -> human label + badge color, mirroring the web status palettes.
import { colors } from "../theme/tokens";

export type BadgeColor = { bg: string; fg: string };

const palette = {
  gray: { bg: "#F3F4F6", fg: "#374151" },
  blue: { bg: "#DBEAFE", fg: "#1D4ED8" },
  indigo: { bg: "#E0E7FF", fg: "#4338CA" },
  amber: { bg: "#FEF3C7", fg: "#B45309" },
  green: { bg: "#DCFCE7", fg: "#15803D" },
  red: { bg: "#FEE2E2", fg: "#B91C1C" },
  purple: { bg: "#F3E8FF", fg: "#7E22CE" },
  teal: { bg: "#CCFBF1", fg: "#0F766E" },
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
  return { label: value ?? "—", color: { bg: colors.border, fg: colors.muted } };
}
