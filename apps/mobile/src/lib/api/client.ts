import axios, { type AxiosRequestHeaders } from "axios";
import { API_URL } from "../env";
import {
  getTokenSync,
  getRefreshTokenSync,
  getCartSessionSync,
  setToken,
  setRefreshToken,
  setCartSession,
  removeToken,
  removeUser,
} from "./token";

/**
 * Axios instance mirroring apps/web/lib/api-client.ts.
 *
 * Unlike the web client, nothing here depends on the cookie jar. React Native does
 * not durably persist cookies across process death on Android, so a cookie-only
 * session silently logs the user out on a cold start and loses the guest cart.
 * Instead this client identifies itself with `X-Client-Platform: mobile`, which
 * makes the API return the refresh token in the response body and the guest cart
 * session in a response header — both persisted to SecureStore (see ./token).
 *
 * `withCredentials` stays on so cookies are still used when they happen to survive;
 * they are a bonus, never the source of truth.
 *
 * Response interceptor: on 401, refresh once (queueing concurrent failures) and
 * retry; on refresh failure, clear auth. Never force-redirects — AuthGuard handles
 * that when a protected screen is opened.
 */
export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 20000,
  headers: { "X-Client-Platform": "mobile" },
});

api.interceptors.request.use((config) => {
  const headers = config.headers as AxiosRequestHeaders;
  const token = getTokenSync();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  // Guest cart identity. Ignored by the API once the request is authenticated.
  const cartSession = getCartSessionSync();
  if (cartSession) {
    headers["X-Cart-Session"] = cartSession;
  }
  return config;
});

// The API echoes the guest cart session it resolved; persist it so the cart
// survives a cold start and can still be merged on sign-in.
api.interceptors.response.use((res) => {
  const session = res.headers?.["x-cart-session"];
  if (typeof session === "string" && session) {
    setCartSession(session);
  }
  return res;
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
      // Bare axios call (no interceptors). Sends our own stored refresh token —
      // the cookie is only a fallback for the case where SecureStore was empty.
      const { data } = await axios.post(
        `${API_URL}/auth/refresh`,
        { refreshToken: getRefreshTokenSync() ?? undefined },
        { withCredentials: true, headers: { "X-Client-Platform": "mobile" } }
      );

      const newToken: string = data.accessToken;
      await setToken(newToken);
      // Refresh tokens rotate — persist the replacement or the next refresh dies.
      if (data.refreshToken) await setRefreshToken(data.refreshToken);
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
