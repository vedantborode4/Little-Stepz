/**
 * Digital Asset Links — proves littlestepz.in and the Android app are the same
 * owner, which is what lets Android open `https://littlestepz.in/ref/<code>` in
 * the app instead of a browser tab.
 *
 * Served here and rewritten onto `/.well-known/assetlinks.json` (see
 * next.config.js) rather than dropped in `public/`, because a dot-prefixed
 * directory is not reliably served across hosts.
 *
 * The fingerprint is Google's **Play App Signing** certificate, not the upload
 * key — Play re-signs every AAB, so the upload key's fingerprint would never
 * match what is installed. Find it at:
 *   Play Console -> Setup -> App integrity -> App signing key certificate -> SHA-256
 *
 * It is public information by design, but it is read from the environment so the
 * value can differ per deployment and this file stays correct without edits.
 * Unset -> 404, which is the honest failure: a malformed assetlinks.json makes
 * Android silently stop verifying, which is far harder to debug than a missing one.
 */
const SHA256_FINGERPRINT = process.env.ANDROID_APP_CERT_SHA256
const PACKAGE_NAME = "in.littlestepz"

export function GET() {
  if (!SHA256_FINGERPRINT) {
    return new Response("assetlinks not configured", { status: 404 })
  }

  const statements = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: PACKAGE_NAME,
        sha256_cert_fingerprints: [SHA256_FINGERPRINT],
      },
    },
  ]

  return new Response(JSON.stringify(statements), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      // Android re-checks periodically; a long cache would delay a fingerprint fix.
      "Cache-Control": "public, max-age=3600",
    },
  })
}
