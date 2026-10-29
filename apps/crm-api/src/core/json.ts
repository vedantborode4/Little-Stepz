import { Prisma } from "@repo/crm-db/client";

/**
 * Converts Prisma values into plain JSON: Decimals become exact strings, Dates
 * become ISO strings, and keys in `omit` are dropped at any depth.
 */
export function toJsonSafe(value: unknown, omit: ReadonlySet<string> = new Set()): unknown {
  if (value === null || value === undefined) return null;
  if (Prisma.Decimal.isDecimal(value)) return (value as Prisma.Decimal).toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map((v) => toJsonSafe(v, omit));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      if (omit.has(key) || v === undefined) continue;
      out[key] = toJsonSafe(v, omit);
    }
    return out;
  }
  return value;
}
