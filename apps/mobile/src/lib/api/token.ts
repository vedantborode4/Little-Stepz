import * as SecureStore from "expo-secure-store";
import type { AuthUser } from "../../types/auth";

/**
 * Token + user storage for mobile.
 *
 * The access token lives in expo-secure-store (encrypted keystore/keychain).
 * Because SecureStore is async but the axios request interceptor is synchronous,
 * we keep an in-memory cache (`cachedToken`) loaded once at bootstrap and updated
 * on every login/refresh, and expose a synchronous getter for the interceptor.
 *
 * The user object is also persisted (non-secret) so the UI can render the
 * logged-in state instantly on cold start, before any network call.
 */

const TOKEN_KEY = "accessToken";
const USER_KEY = "authUser";

let cachedToken: string | null = null;

/** Load token from secure storage into the in-memory cache. Call once at bootstrap. */
export async function loadToken(): Promise<string | null> {
  try {
    cachedToken = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    cachedToken = null;
  }
  return cachedToken;
}

/** Synchronous accessor used by the axios request interceptor. */
export function getTokenSync(): string | null {
  return cachedToken;
}

export async function setToken(token: string): Promise<void> {
  cachedToken = token;
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {
    // keystore write failure is non-fatal — in-memory cache still works this session
  }
}

export async function removeToken(): Promise<void> {
  cachedToken = null;
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export async function loadUser(): Promise<AuthUser | null> {
  try {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export async function setUser(user: AuthUser): Promise<void> {
  try {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  } catch {
    // ignore
  }
}

export async function removeUser(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(USER_KEY);
  } catch {
    // ignore
  }
}
