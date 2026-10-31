import type { ListQuery, Paginated } from "@repo/crm-schema";
import { ApiError } from "./http";

/** Rows an export may contain; larger exports must be filtered first. */
export const EXPORT_MAX_ROWS = 50_000;

type SortDirection = "asc" | "desc";

/**
 * Translates `field:dir` into a Prisma orderBy using a whitelist, so clients can
 * only sort on indexed, intended columns. Values are Prisma paths ("user.name").
 * `id` is always appended as a tiebreaker for stable pagination. Lists sorted by a
 * date-only column pass `thenBy` (e.g. "createdAt"), or same-day rows come out in
 * random UUID order.
 */
export function buildOrderBy(
  sort: string | undefined,
  allowed: Record<string, string>,
  fallback: `${string}:${SortDirection}`,
  thenBy?: string,
): Record<string, unknown>[] {
  const [key, direction] = (sort ?? fallback).split(":") as [string, SortDirection];
  const path = allowed[key];
  if (!path) throw new ApiError(400, "INVALID_SORT", `Cannot sort by "${key}"`);
  const tie = thenBy && thenBy !== path ? [nestedOrder(thenBy, direction)] : [];
  return [nestedOrder(path, direction), ...tie, { id: direction }];
}

function nestedOrder(path: string, direction: SortDirection): Record<string, unknown> {
  return path
    .split(".")
    .reverse()
    .reduce<unknown>((acc, segment) => ({ [segment]: acc }), direction) as Record<string, unknown>;
}

/** Skip/take for a page, or the export cap when the request is an export. */
export function pageWindow(query: Pick<ListQuery, "page" | "limit" | "format">) {
  if (query.format) return { skip: 0, take: EXPORT_MAX_ROWS };
  return { skip: (query.page - 1) * query.limit, take: query.limit };
}

export function paginated<T>(items: T[], total: number, query: Pick<ListQuery, "page" | "limit">): Paginated<T> {
  return { items, total, page: query.page, limit: query.limit };
}

/** Case-insensitive `contains` across several columns, or undefined when there is no search. */
export function searchAcross(q: string | undefined, fields: string[]) {
  if (!q) return undefined;
  return fields.map((field) => ({ [field]: { contains: q, mode: "insensitive" as const } }));
}
