import type { AxiosError } from "axios"
import type { ApiErrorBody } from "@repo/crm-schema"

export type FieldErrors = Record<string, string[] | undefined>

/** The single error type every API call rejects with. */
export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors: FieldErrors = {},
  ) {
    super(message)
  }
}

export const isApiError = (err: unknown): err is ApiRequestError => err instanceof ApiRequestError

export function toApiError(err: AxiosError<ApiErrorBody>): ApiRequestError {
  if (!err.response) {
    return new ApiRequestError(0, "NETWORK", "Can't reach the server. Check your connection and try again.")
  }
  const body = err.response.data?.error
  return new ApiRequestError(
    err.response.status,
    body?.code ?? "UNKNOWN",
    body?.message ?? "Something went wrong. Please try again.",
    body?.details?.fieldErrors ?? {},
  )
}

export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again.") {
  return isApiError(err) ? err.message : fallback
}
