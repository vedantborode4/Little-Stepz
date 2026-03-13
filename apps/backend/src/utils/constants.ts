// ──────────────────────────────────────────────────────────────
//  Cookie options for access & refresh tokens
// ──────────────────────────────────────────────────────────────
//
//  SECURE FLAG
//  -----------
//  `secure: true` tells the browser to ONLY send the cookie over HTTPS.
//  If your server is on plain HTTP (no SSL), the browser silently
//  refuses to store the cookie — auth breaks completely.
//
//  We use an explicit env var so you control this per-environment:
//
//    COOKIE_SECURE=true   →  production with SSL
//    COOKIE_SECURE=false  →  VPS without SSL / local dev
//
//  If COOKIE_SECURE is not set, we fall back to checking NODE_ENV,
//  but that default will ONLY work if you actually have SSL in prod.
//
//  SAMESITE
//  --------
//  "lax" is the safe default for cross-port same-host setups
//  (e.g. frontend :3000, backend :8000 on same VPS).
//  "strict" blocks cookies on ANY cross-site navigation (even
//  clicking a link from email to your site), which can break login.
//  "none" requires secure: true (HTTPS).
//
//  Recommendation:
//    - Use "lax" until you have SSL sorted
//    - Switch to "strict" after SSL is live if desired
// ──────────────────────────────────────────────────────────────

const isSecure = process.env.COOKIE_SECURE
  ? process.env.COOKIE_SECURE === "true"
  : process.env.NODE_ENV === "production";

const sameSite = (process.env.COOKIE_SAMESITE as "strict" | "lax" | "none") || "lax";

export const accessTokenCookieOptions = {
  httpOnly: true,
  secure: isSecure,
  sameSite,
  maxAge: 30 * 60 * 1000, // 30 minutes
};

export const refreshTokenCookieOptions = {
  httpOnly: true,
  secure: isSecure,
  sameSite,
  maxAge: 15 * 24 * 60 * 60 * 1000, // 15 days
};
