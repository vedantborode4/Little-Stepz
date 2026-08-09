import * as SecureStore from "expo-secure-store";
import type { AuthUser } from "../../types/auth";

/**
 * Token + session storage for mobile.
 *
 * Everything the session depends on is owned by the app, not by the cookie jar:
 * React Native does not durably persist cookies across process death on Android,
 * so a cookie-only session silently signs the user out (and loses a guest cart)
 * on a cold start. The backend therefore hands native clients the refresh token
 * in the response body and the guest cart session in a response header — see
 * apps/backend/src/utils/client.ts.
 *
 * SecureStore is async but the axios request interceptor is synchronous, so each
 * value is mirrored in an in-memory cache hydrated once at bootstrap
 * (`loadSession`) and updated on every write.
 */

const TOKEN_KEY = "accessToken";
const REFRESH_KEY = "refreshToken";
const USER_KEY = "authUser";
const CART_SESSION_KEY = "cartSession";

let cachedToken: string | null = null;
let cachedRefreshToken: string | null = null;
let cachedCartSession: string | null = null;

async function readSecure(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function writeSecure(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // keystore write failure is non-fatal — the in-memory cache still works this session
  }
}

async function deleteSecure(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // ignore
  }
}

/** Hydrate every cached session value. Call once at bootstrap. */
export async function loadSession(): Promise<{
  token: string | null;
  user: AuthUser | null;
}> {
  const [token, refresh, cartSession, rawUser] = await Promise.all([
    readSecure(TOKEN_KEY),
    readSecure(REFRESH_KEY),
    readSecure(CART_SESSION_KEY),
    readSecure(USER_KEY),
  ]);

  cachedToken = token;
  cachedRefreshToken = refresh;
  cachedCartSession = cartSession;

  let user: AuthUser | null = null;
  try {
    user = rawUser ? (JSON.parse(rawUser) as AuthUser) : null;
  } catch {
    user = null;
  }

  return { token, user };
}

/** Synchronous accessors used by the axios interceptors. */
export function getTokenSync(): string | null {
  return cachedToken;
}

export function getRefreshTokenSync(): string | null {
  return cachedRefreshToken;
}

export function getCartSessionSync(): string | null {
  return cachedCartSession;
}

export async function setToken(token: string): Promise<void> {
  cachedToken = token;
  await writeSecure(TOKEN_KEY, token);
}

export async function setRefreshToken(token: string): Promise<void> {
  cachedRefreshToken = token;
  await writeSecure(REFRESH_KEY, token);
}

/** Persist the guest cart session id echoed back by the API. */
export async function setCartSession(sessionId: string): Promise<void> {
  if (!sessionId || sessionId === cachedCartSession) return;
  cachedCartSession = sessionId;
  await writeSecure(CART_SESSION_KEY, sessionId);
}

export async function removeCartSession(): Promise<void> {
  cachedCartSession = null;
  await deleteSecure(CART_SESSION_KEY);
}

export async function removeToken(): Promise<void> {
  cachedToken = null;
  cachedRefreshToken = null;
  await Promise.all([deleteSecure(TOKEN_KEY), deleteSecure(REFRESH_KEY)]);
}

export async function setUser(user: AuthUser): Promise<void> {
  await writeSecure(USER_KEY, JSON.stringify(user));
}

export async function removeUser(): Promise<void> {
  await deleteSecure(USER_KEY);
}
