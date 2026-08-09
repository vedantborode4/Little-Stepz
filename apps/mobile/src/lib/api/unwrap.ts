import type { AxiosResponse } from "axios";

/**
 * The backend envelope is inconsistent:
 *  - auth endpoints return fields at the top level: `res.data.accessToken`
 *  - most others wrap as `res.data.data`
 *
 * `unwrapData` tolerates both; `unwrapTop` is for auth (top-level) responses.
 * Per-service code should still match the web service's exact choice where it
 * matters, but these helpers are the safe default.
 */
export function unwrapData<T = any>(res: AxiosResponse): T {
  const body = res.data;
  if (body && typeof body === "object" && "data" in body) {
    return (body as any).data as T;
  }
  return body as T;
}

export function unwrapTop<T = any>(res: AxiosResponse): T {
  return res.data as T;
}
