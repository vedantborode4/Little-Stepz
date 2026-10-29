import { z } from "zod";

/**
 * Money crosses the wire as a decimal string ("1250.50"), never a float, so a value
 * is exactly what the user typed. Numbers are accepted for convenience but must
 * still stringify to at most two decimals — 0.1 + 0.2 is rejected, not rounded.
 */
const MONEY_PATTERN = /^\d{1,12}(\.\d{1,2})?$/;
const PERCENT_PATTERN = /^\d{1,3}(\.\d{1,2})?$/;

export const money = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .pipe(z.string().regex(MONEY_PATTERN, "Enter an amount with at most 2 decimals"));

export const percent = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .pipe(
    z
      .string()
      .regex(PERCENT_PATTERN, "Enter a percentage with at most 2 decimals")
      .refine((v) => Number(v) <= 100, "Percentage cannot exceed 100"),
  );

export const requiredText = (max: number) => z.string().trim().min(1, "Required").max(max);

/** Empty strings from cleared inputs become `null`, so "remove this value" is expressible. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullish();

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const idParam = z.object({ id: z.string().uuid() });

export const SORT_PATTERN = /^[a-zA-Z][a-zA-Z0-9.]*:(asc|desc)$/;

export const EXPORT_FORMATS = ["csv", "xlsx"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const MAX_PAGE_SIZE = 100;

export const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(25),
  q: z.string().trim().max(100).optional(),
  sort: z.string().regex(SORT_PATTERN, "Use field:asc or field:desc").optional(),
  format: z.enum(EXPORT_FORMATS).optional(),
});
export type ListQuery = z.infer<typeof listQuery>;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
