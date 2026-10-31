import type { z } from "zod"
import { isApiError } from "./api-error"

export type ErrorMap = Record<string, string>

/** Zod issues → { "lines.0.quantity": "At least 1" }, keeping the first message per field. */
export function issuesToErrors(issues: z.core.$ZodIssue[]): ErrorMap {
  const out: ErrorMap = {}
  for (const issue of issues) {
    const key = issue.path.map(String).join(".")
    out[key] ??= issue.message
  }
  return out
}

/** Field errors from an API rejection, in the same shape. */
export function apiErrorsToMap(err: unknown): ErrorMap {
  if (!isApiError(err)) return {}
  return Object.fromEntries(Object.entries(err.fieldErrors).flatMap(([k, v]) => (v?.[0] ? [[k, v[0]]] : [])))
}
