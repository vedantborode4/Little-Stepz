import { Prisma } from "@repo/crm-db/client";

export const Decimal = Prisma.Decimal;
export type Decimal = Prisma.Decimal;

export const dec = (value: string | number | Decimal) => new Decimal(value);

/** A database or computed amount as a Decimal; null and undefined count as zero. */
export const decOrZero = (value: Decimal | string | number | null | undefined) => new Decimal((value ?? 0).toString());

/** Rounds to paise the way every money figure is rounded: half to even. */
export const round2 = (value: Decimal) => value.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);

/** API representation of money: exact 2-decimal string. */
export const money = (value: Decimal) => value.toFixed(2);
export const moneyOrNull = (value: Decimal | null | undefined) => (value ? value.toFixed(2) : null);

/** Null-aware equality for optional prices. */
export function sameMoney(a: Decimal | null | undefined, b: string | null | undefined) {
  if (a == null || b == null) return a == null && b == null;
  return a.equals(b);
}
