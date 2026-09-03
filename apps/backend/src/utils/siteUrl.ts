/**
 * The one public origin to build customer-facing links from.
 *
 * `FRONTEND_URL` does double duty: it is also the CORS allow-list, and is set in some
 * environments to a bracketed, comma-separated list of dev origins —
 * `[http://localhost:3000, exp://10.0.0.1:8081, ...]`. Interpolating that straight into a
 * URL produced links like
 *
 *   [http://localhost:3000, exp://10.0.0.1:8081]/reset-password?token=abc
 *
 * which is exactly what every password reset, referral, pre-order balance and policy link
 * in the product looked like. Nobody noticed because the emails still sent; only the link
 * inside them was dead.
 *
 * Resolution order: `PUBLIC_SITE_URL` if set (the explicit, unambiguous answer), otherwise
 * the first usable http(s) entry in `FRONTEND_URL`. `exp://` and other schemes are skipped
 * — a deep link belongs in an app, not in an email a customer opens on a desktop.
 */
export function publicSiteUrl(): string {
  const explicit = process.env.PUBLIC_SITE_URL?.trim();
  if (explicit) return stripTrailingSlash(explicit);

  const raw = process.env.FRONTEND_URL?.trim();
  if (!raw) return "";

  // Tolerate the bracketed-list form as well as a bare single URL.
  const candidates = raw
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  // Prefer https, so a list that happens to lead with a local http origin still yields
  // the real site when one is present.
  const https = candidates.find((c) => c.startsWith("https://"));
  const http = candidates.find((c) => c.startsWith("http://"));
  const chosen = https ?? http ?? "";

  return stripTrailingSlash(chosen);
}

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}
