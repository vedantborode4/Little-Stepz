/**
 * Preserving where the user was headed when they hit a sign-in wall.
 *
 * The sign-in page already honoured a `?redirect=` param, but nothing ever set it —
 * every guard and the 401 interceptor pushed a bare "/signin", so a customer deep
 * linked to an order (from an order email or a push notification) signed in and
 * landed on the homepage instead, with no way back. Checkout is the sharpest case:
 * sign-up is mandatory to place an order (we deliver to the customer's address and
 * need their account + contact), so a shopper who signs up from /checkout MUST be
 * returned to /checkout, not dropped on the homepage to start over.
 */

/**
 * Auth routes are never a valid post-auth destination: sending a just-signed-in user
 * back to /signin (or /signup) loops them straight into GuestGuard, which bounces them
 * off again. Used to reject such a target both when building the sign-in URL and when
 * reading it back after auth.
 */
const AUTH_PAGE = /^\/(signin|signup|forgot-password|reset-password)(\/|\?|$)/

/** Path the user is currently on, including query and hash. */
export function currentPath(): string {
  if (typeof window === "undefined") return "/"
  return window.location.pathname + window.location.search + window.location.hash
}

/**
 * Sign-in URL that remembers `target`.
 *
 * Auth pages are never used as a target — bouncing back to /signin after signing in
 * would loop.
 */
export function signInUrl(target: string = currentPath()): string {
  if (!target || target === "/" || AUTH_PAGE.test(target)) return "/signin"
  return `/signin?redirect=${encodeURIComponent(target)}`
}

/**
 * Where to send the user after a successful sign-in / sign-up.
 *
 * Security & edge cases are handled here once so every caller (sign-in, sign-up,
 * GuestGuard, GoogleAuthButton) stays consistent:
 *  - SSR: no `window`, so default to "/".
 *  - Missing param: default to "/".
 *  - Open redirect: only same-site absolute paths are accepted. A protocol-relative
 *    value like `//evil.com` is a path by `startsWith("/")` but navigates off-site,
 *    so it is rejected explicitly.
 *  - Loop guard: an auth page as the target would bounce the freshly-authed user
 *    straight back through GuestGuard, so it is rejected too.
 */
export function safeRedirectTarget(): string {
  if (typeof window === "undefined") return "/"
  const target = new URLSearchParams(window.location.search).get("redirect")
  if (!target) return "/"
  if (!target.startsWith("/") || target.startsWith("//")) return "/"
  if (AUTH_PAGE.test(target)) return "/"
  return target
}

/**
 * Carry the active `?redirect=` across the sign-in <-> sign-up toggle.
 *
 * A customer bounced to /signup?redirect=/checkout who taps "Already have an account?
 * Sign in" must keep the return path — otherwise switching forms silently drops them on
 * the homepage after auth. The value is forwarded verbatim (it only ever originates from
 * our own links) and is re-validated by safeRedirectTarget when it is finally consumed.
 */
export function withActiveRedirect(basePath: string): string {
  if (typeof window === "undefined") return basePath
  const redirect = new URLSearchParams(window.location.search).get("redirect")
  if (!redirect) return basePath
  return `${basePath}?redirect=${encodeURIComponent(redirect)}`
}
