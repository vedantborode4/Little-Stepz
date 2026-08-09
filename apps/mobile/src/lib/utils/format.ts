import { format, formatDistanceToNow } from "date-fns";

/** Relative time like "3h ago" / "2 days ago". */
export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return "";
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch {
    return "";
  }
}

/** Format a number/decimal-string as INR currency. */
export function formatPrice(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  if (Number.isNaN(n)) return "₹0";
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  try {
    return format(new Date(value), "dd MMM yyyy");
  } catch {
    return "";
  }
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  try {
    return format(new Date(value), "dd MMM yyyy, h:mm a");
  } catch {
    return "";
  }
}

/** Short order id for display (last 8 chars, uppercased). */
export function shortId(id: string | null | undefined): string {
  if (!id) return "";
  return id.slice(-8).toUpperCase();
}
