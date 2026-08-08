import { Request } from "express";

/**
 * Native clients (the Expo app) cannot rely on cookies: React Native's cookie jar
 * is not durably persisted across process death on Android, so an httpOnly refresh
 * cookie can silently vanish and log the user out.
 *
 * Such clients send `X-Client-Platform: mobile`, and in return the auth endpoints
 * also hand back the refresh token in the JSON body (and accept it there), while
 * the cart accepts its guest session id via `X-Cart-Session`.
 *
 * Browsers never send this header, so the web app keeps the strictly safer
 * cookie-only behaviour — the token is never exposed to page JavaScript.
 */
export const NATIVE_CLIENT_HEADER = "x-client-platform";
export const CART_SESSION_HEADER = "x-cart-session";

export function isNativeClient(req: Request): boolean {
  return req.get(NATIVE_CLIENT_HEADER)?.toLowerCase() === "mobile";
}
