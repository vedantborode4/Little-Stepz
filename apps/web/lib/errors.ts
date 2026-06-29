/** First non-empty message from a zod/server fieldErrors map. */
export function firstFieldError(
  fieldErrors?: Record<string, string[] | undefined> | null
): string | null {
  if (!fieldErrors) return null
  for (const msgs of Object.values(fieldErrors)) {
    const m = msgs?.find(Boolean)
    if (m) return m
  }
  return null
}

/**
 * Extracts the most specific human-readable message from an axios error,
 * preferring a server field error, then the server message, then the JS error.
 * Returns the server's per-field errors too so callers can render them inline.
 */
export function getApiError(
  e: any,
  fallback = "Something went wrong"
): { message: string; fieldErrors?: Record<string, string[]> } {
  const data = e?.response?.data
  const fieldErrors =
    data?.errors && typeof data.errors === "object" && !Array.isArray(data.errors)
      ? (data.errors as Record<string, string[]>)
      : undefined
  const message = firstFieldError(fieldErrors) || data?.message || e?.message || fallback
  return { message, fieldErrors }
}
