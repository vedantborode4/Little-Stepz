/**
 * Preserving where the user was headed when they hit a sign-in wall.
 *
 * The sign-in page already honoured a `?redirect=` param, but nothing ever set it —
 * every guard and the 401 interceptor pushed a bare "/signin", so a customer deep
 * linked to an order (from an order email or a push notification) signed in and
 * landed on the homepage instead, with no way back.
 */

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
  const isAuthPage = /^\/(signin|signup|forgot-password|reset-password)(\/|\?|$)/.test(target)
  if (!target || target === "/" || isAuthPage) return "/signin"
  return `/signin?redirect=${encodeURIComponent(target)}`
}

/**
 * Where to send the user after a successful sign-in.
 *
 * Only same-site absolute paths are accepted. A protocol-relative value like
 * `//evil.com` is a path by `startsWith("/")` but navigates off-site, so it is
 * rejected explicitly.
 */
export function safeRedirectTarget(): string {
  if (typeof window === "undefined") return "/"
  const target = new URLSearchParams(window.location.search).get("redirect")
  if (!target) return "/"
  if (!target.startsWith("/") || target.startsWith("//")) return "/"
  return target
}
