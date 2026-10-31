import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios"
import type { ApiErrorBody, SessionDto } from "@repo/crm-schema"
import { useAuthStore } from "@/store/auth.store"
import { toApiError } from "./api-error"

export const API_BASE = "/api/v1"

export const api = axios.create({ baseURL: API_BASE, withCredentials: true })

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let inFlightRefresh: Promise<string> | null = null

/**
 * Single-flight: every caller that hits a 401 while a refresh is running awaits the
 * same promise, so a burst of expired requests triggers exactly one rotation.
 */
export function refreshSession(): Promise<string> {
  inFlightRefresh ??= axios
    .post<{ data: SessionDto }>(`${API_BASE}/auth/refresh`, {}, { withCredentials: true })
    .then((res) => {
      useAuthStore.getState().setSession(res.data.data)
      return res.data.data.accessToken
    })
    .finally(() => {
      inFlightRefresh = null
    })
  return inFlightRefresh
}

export function redirectToLogin() {
  useAuthStore.getState().clear()
  const next = window.location.pathname + window.location.search
  window.location.href = `/login?next=${encodeURIComponent(next)}`
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean }

/** A 401 from these means "not signed in", not "token expired" — never retry them. */
const SESSION_ENDPOINTS = new Set(["/auth/login", "/auth/refresh", "/auth/logout"])

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError<ApiErrorBody>) => {
    // Blob downloads (exports) return errors as blobs too; decode so the message survives.
    if (err.response?.data instanceof Blob) {
      try {
        err.response.data = JSON.parse(await err.response.data.text())
      } catch {
        /* leave as-is */
      }
    }

    const config = err.config as RetriableConfig | undefined
    const isSessionCall = SESSION_ENDPOINTS.has(config?.url ?? "")
    if (err.response?.status === 401 && config && !config._retried && !isSessionCall) {
      config._retried = true
      try {
        const token = await refreshSession()
        config.headers.Authorization = `Bearer ${token}`
        return api(config)
      } catch {
        redirectToLogin()
      }
    }
    return Promise.reject(toApiError(err))
  },
)

/** Unwraps the `{ data }` envelope. */
export async function getData<T>(url: string, params?: object): Promise<T> {
  const res = await api.get<{ data: T }>(url, { params })
  return res.data.data
}

export async function sendData<T>(method: "post" | "put" | "patch" | "delete", url: string, body?: unknown): Promise<T> {
  const res = await api.request<{ data: T }>({ method, url, data: body })
  return res.data.data
}
