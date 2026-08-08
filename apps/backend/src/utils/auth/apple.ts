import { createPublicKey, KeyObject } from "crypto";
import jwt, { JwtPayload } from "jsonwebtoken";
import { InvalidTokenError } from "./errors";

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_KEYS_URL = "https://appleid.apple.com/auth/keys";
const KEY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Accept identity tokens minted for any of our Apple client ids (the iOS bundle
// identifier for native sign-in, plus a Services ID if web ever uses it).
//
// Unlike google.ts this does NOT throw at module load: Apple sign-in is iOS-only
// and arrived after the backend was already deployed, so an unset variable must
// fail this one endpoint rather than refuse to boot the whole API.
const APPLE_CLIENT_IDS = (process.env.APPLE_CLIENT_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

interface AppleJwk {
  kid: string;
  kty: string;
  alg: string;
  n: string;
  e: string;
}

let cachedKeys: Map<string, KeyObject> | null = null;
let cachedAt = 0;

async function fetchAppleKeys(): Promise<Map<string, KeyObject>> {
  const res = await fetch(APPLE_KEYS_URL);
  if (!res.ok) {
    throw new InvalidTokenError("Could not reach Apple to verify the credential");
  }

  const { keys } = (await res.json()) as { keys: AppleJwk[] };
  const parsed = new Map<string, KeyObject>();

  for (const jwk of keys) {
    parsed.set(jwk.kid, createPublicKey({ key: jwk as never, format: "jwk" }));
  }

  cachedKeys = parsed;
  cachedAt = Date.now();
  return parsed;
}

/**
 * Apple rotates its signing keys without notice, so an unknown `kid` forces a
 * refetch even when the cache is still within its TTL.
 */
async function getApplePublicKey(kid: string): Promise<KeyObject> {
  const fresh = cachedKeys && Date.now() - cachedAt < KEY_CACHE_TTL_MS;
  if (fresh) {
    const hit = cachedKeys!.get(kid);
    if (hit) return hit;
  }

  const keys = await fetchAppleKeys();
  const key = keys.get(kid);
  if (!key) {
    throw new InvalidTokenError("Unknown Apple signing key");
  }
  return key;
}

export interface AppleProfile {
  sub: string;
  /**
   * Absent on some repeat sign-ins — Apple is only guaranteed to send the email
   * on the first authorization. Callers must handle the undefined case.
   */
  email?: string;
  emailVerified: boolean;
}

export const verifyAppleIdentityToken = async (
  identityToken: string
): Promise<AppleProfile> => {
  if (APPLE_CLIENT_IDS.length === 0) {
    throw new Error("APPLE_CLIENT_IDS is not set");
  }

  const decoded = jwt.decode(identityToken, { complete: true });
  const kid = decoded?.header?.kid;
  if (!kid) {
    throw new InvalidTokenError("Apple identity token is malformed");
  }

  const publicKey = await getApplePublicKey(kid);

  let payload: JwtPayload;
  try {
    payload = jwt.verify(identityToken, publicKey, {
      algorithms: ["RS256"],
      // Guarded non-empty above; jsonwebtoken's type wants a non-empty tuple.
      audience: APPLE_CLIENT_IDS as [string, ...string[]],
      issuer: APPLE_ISSUER,
    }) as JwtPayload;
  } catch {
    throw new InvalidTokenError("Invalid Apple credential");
  }

  if (!payload.sub) {
    throw new InvalidTokenError("Apple credential missing required fields");
  }

  // Apple sends email_verified as either a boolean or the string "true".
  const verified = payload.email_verified;

  return {
    sub: payload.sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
    emailVerified: verified === true || verified === "true",
  };
};
