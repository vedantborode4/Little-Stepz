/**
 * Resize a Cloudinary image URL on the fly for thumbnails/cards.
 *
 * Inserts transforms after `/upload/`: auto format (webp/avif), auto quality,
 * and a target size — so a 170px card downloads a ~400px image instead of the
 * full-resolution original. Massively smaller payloads → faster lists, less
 * memory, smoother scrolling. Non-Cloudinary URLs (or already-transformed ones)
 * are returned unchanged.
 */
export function cldImage(
  url: string | null | undefined,
  opts: { w: number; h?: number; crop?: "fill" | "limit" }
): string | undefined {
  if (!url) return undefined;
  const marker = "/upload/";
  const i = url.indexOf(marker);
  if (i === -1 || !url.includes("res.cloudinary.com")) return url;

  const after = url.slice(i + marker.length);
  // Already has a transform segment (e.g. "w_400,...") right after /upload/ — leave it.
  if (/^[a-z]{1,3}_[^/]+/.test(after)) return url;

  const crop = opts.crop ?? "limit";
  const t = [`f_auto`, `q_auto`, `c_${crop}`, `w_${Math.round(opts.w)}`];
  if (opts.h) t.push(`h_${Math.round(opts.h)}`);

  return url.slice(0, i + marker.length) + t.join(",") + "/" + after;
}
