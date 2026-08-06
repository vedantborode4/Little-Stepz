import axios from "axios";
import { API_URL } from "../env";
import { getTokenSync, setToken, removeToken, removeUser } from "./token";

/**
 * Axios instance mirroring apps/web/lib/api-client.ts.
 *
 * - `withCredentials: true` so React Native's native cookie store carries the
 *   httpOnly refresh cookie (and the cart-session cookie) to /auth/refresh & /cart.
 * - Request interceptor attaches the Bearer access token from the in-memory cache.
 * - Response interceptor: on 401, refresh once (queueing concurrent failures),
 *   retry; on refresh failure, clear auth and bounce to sign-in.
 */
export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = getTokenSync();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
type QueueEntry = {
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
};
let failedQueue: QueueEntry[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((p) => {
    if (error) p.reject(error);
    else if (token) p.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;
    const url: string = originalRequest?.url || "";

    // Never try to refresh for the auth endpoints themselves. A wrong-password
    // sign-in returns 401 — without this guard the interceptor would call
    // /auth/refresh (which fails with "refresh token required") and surface THAT
    // message instead of "Invalid email or password".
    const isAuthEndpoint =
      url.includes("/auth/signin") ||
      url.includes("/auth/signup") ||
      url.includes("/auth/refresh") ||
      url.includes("/auth/forgot-password") ||
      url.includes("/auth/verify-reset-code") ||
      url.includes("/auth/reset-password");

    if (error.response?.status !== 401 || originalRequest?._retry || isAuthEndpoint) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          },
          reject,
        });
      });
    }

    isRefreshing = true;

    try {
      // Bare axios call (no interceptors) — relies on the native cookie jar for the refresh cookie.
      const { data } = await axios.post(
        `${API_URL}/auth/refresh`,
        {},
        { withCredentials: true }
      );

      const newToken: string = data.accessToken;
      await setToken(newToken);
      processQueue(null, newToken);

      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch (err) {
      processQueue(err, null);
      await removeToken();
      await removeUser();

      // Dynamic import avoids a circular dep (client → auth.store → cart.store → cart.service → client).
      try {
        const { useAuthStore } = await import("../../store/auth.store");
        useAuthStore.getState().logout();
      } catch {
        // ignore
      }

      // Do NOT force-redirect to sign-in here. An expired session at launch would
      // otherwise drop the user on the login screen instead of the homepage.
      // `AuthGuard` already redirects when a *protected* screen is opened.
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  }
);
