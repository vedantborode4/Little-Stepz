import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { exchangeCodeAsync } from "expo-auth-session";

import { AuthService } from "../services/auth.service";
import type { AuthResponse } from "../../types/auth";

/**
 * Google OAuth callback handling, split out of `useGoogleAuth` so the redirect can
 * be completed from anywhere — including a cold start.
 *
 * Two things this fixes, both invisible in Expo Go:
 *
 * 1. The redirect URI is **pinned**, not derived. `makeRedirectUri` returns either
 *    the app scheme or `applicationId:/oauthredirect` depending on
 *    `Constants.executionEnvironment`, so the value differed between Expo Go and
 *    store builds. Google binds an Android OAuth client to the *package name*, so
 *    that is what we send, always.
 *
 * 2. The PKCE verifier is persisted **before** the browser opens. Android can kill
 *    the app while the user is in the Google tab (several OEM skins do this
 *    eagerly, and the "Don't keep activities" developer option guarantees it). On
 *    return the process is new, `AuthSession`'s in-memory listener is gone, and the
 *    code arrives as a plain deep link. Without a stored verifier that code cannot
 *    be redeemed — which is exactly how a user ended up on an "Unmatched Route"
 *    screen, signed out, holding a perfectly valid authorization code.
 */
export const GOOGLE_REDIRECT_URI = "in.littlestepz:/oauthredirect";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const PENDING_KEY = "googleOAuthPending";

type PendingAuth = {
  codeVerifier: string;
  /** Echoed back by Google; guards against a forged or stale callback. */
  state: string;
  /** Must be the same client the authorization request used, or the exchange 401s. */
  clientId: string;
};

/** The client id for the current platform — mirrors `Google.useAuthRequest`. */
export function platformGoogleClientId(): string | undefined {
  if (Platform.OS === "android") return process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID;
  if (Platform.OS === "ios") return process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS;
  return process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB;
}

export async function savePendingGoogleAuth(pending: PendingAuth): Promise<void> {
  try {
    await SecureStore.setItemAsync(PENDING_KEY, JSON.stringify(pending));
  } catch {
    // Non-fatal: the warm path still works from memory; only cold-start recovery is lost.
  }
}

async function readPendingGoogleAuth(): Promise<PendingAuth | null> {
  try {
    const raw = await SecureStore.getItemAsync(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingAuth) : null;
  } catch {
    return null;
  }
}

export async function clearPendingGoogleAuth(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PENDING_KEY);
  } catch {
    // ignore
  }
}

/**
 * Pulls `code`/`state` out of a callback deep link. Deliberately scheme-agnostic:
 * it matches on the `oauthredirect` path so it works whether the URL arrives as
 * `in.littlestepz:/oauthredirect` or `littlestepz://oauthredirect`.
 */
export function extractGoogleCallback(
  url: string | null | undefined
): { code: string; state?: string } | null {
  if (!url || !url.includes("oauthredirect")) return null;

  const query = url.split("?")[1];
  if (!query) return null;

  const params: Record<string, string> = {};
  for (const pair of query.split("&")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    try {
      params[decodeURIComponent(pair.slice(0, eq))] = decodeURIComponent(pair.slice(eq + 1));
    } catch {
      // a malformed pair should not discard the rest of the callback
    }
  }

  return params.code ? { code: params.code, state: params.state } : null;
}

/**
 * Single-flight guard. The warm path (AuthSession resolves) and the cold path (the
 * deep-link listener) can both fire for the same callback, and an authorization
 * code is single-use — a second redemption fails and would surface as a spurious
 * "sign-in failed" after a successful sign-in.
 */
let inFlight: Promise<AuthResponse | null> | null = null;

/**
 * Redeems an authorization code and returns the backend session, or `null` when
 * there is nothing to do (no stored verifier — i.e. already consumed).
 * Callers own `login()` and navigation.
 */
export function completeGoogleAuth(
  code: string,
  state?: string
): Promise<AuthResponse | null> {
  if (!inFlight) {
    inFlight = runExchange(code, state).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function runExchange(code: string, state?: string): Promise<AuthResponse | null> {
  const pending = await readPendingGoogleAuth();
  if (!pending) return null;

  if (pending.state && state && pending.state !== state) {
    await clearPendingGoogleAuth();
    throw new Error("Google sign-in could not be verified. Please try again.");
  }

  // Clear before redeeming: the code is single-use, so a retry must start over
  // rather than replay a verifier that Google has already burned.
  await clearPendingGoogleAuth();

  const token = await exchangeCodeAsync(
    {
      clientId: pending.clientId,
      code,
      redirectUri: GOOGLE_REDIRECT_URI,
      extraParams: { code_verifier: pending.codeVerifier },
    },
    { tokenEndpoint: TOKEN_ENDPOINT }
  );

  if (!token.idToken) {
    throw new Error("Google did not return an identity token.");
  }

  return AuthService.googleAuth(token.idToken);
}
