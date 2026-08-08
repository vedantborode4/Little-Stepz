import Constants from "expo-constants";

/**
 * Resolves the backend API base URL.
 *
 * Priority:
 *  1. EXPO_PUBLIC_API_URL (set in apps/mobile/.env for staging/prod or to override).
 *  2. Dev auto-derive: take the host the Metro bundler is served from
 *     (Constants.expoConfig.hostUri, e.g. "10.0.0.5:8081") and point at :8000.
 *     This lets a physical Expo Go device reach the dev machine without hardcoding
 *     the LAN IP. `localhost`/`127.0.0.1` will NOT work from a real device.
 *  3. Last-resort localhost (works for web / iOS simulator only).
 */
const PRODUCTION_API_URL = "https://littlestepz.in/api/v1";

function resolveApiUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  // A release build has no Metro host to derive from, so the dev fallbacks below
  // would resolve to localhost and ship a store binary that reaches no backend.
  if (!__DEV__) return PRODUCTION_API_URL;

  const hostUri = Constants.expoConfig?.hostUri ?? "";

  const host = hostUri.split(":")[0];
  if (host) {
    return `http://${host}:8000/api/v1`;
  }

  return "http://localhost:8000/api/v1";
}

export const API_URL = resolveApiUrl();

/** Razorpay checkout script + origin used by the WebView payment screen. */
export const RAZORPAY_CHECKOUT_JS = "https://checkout.razorpay.com/v1/checkout.js";
export const RAZORPAY_ORIGIN = "https://checkout.razorpay.com";

/**
 * tawk.to live chat (anonymous). Property/Widget IDs are public embed identifiers,
 * so EXPO_PUBLIC_* is appropriate — there is no secret. Falls back to null when
 * unconfigured, and the Support screen degrades gracefully.
 */
const TAWK_PROPERTY_ID = process.env.EXPO_PUBLIC_TAWK_PROPERTY_ID;
const TAWK_WIDGET_ID = process.env.EXPO_PUBLIC_TAWK_WIDGET_ID;

export const TAWK_CHAT_URL =
  TAWK_PROPERTY_ID && TAWK_WIDGET_ID
    ? `https://tawk.to/chat/${TAWK_PROPERTY_ID}/${TAWK_WIDGET_ID}`
    : null;
