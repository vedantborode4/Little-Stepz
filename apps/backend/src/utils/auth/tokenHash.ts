import { createHash, timingSafeEqual } from "crypto";

export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

/** Constant-time compare of two sha256 hex digests. */
export const timingSafeEqualHex = (a: string, b: string) => {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
};
