/**
 * Insert a square "fill" transform into a Cloudinary delivery URL so the image
 * fills its box with no letterboxing. Content-aware (`g_auto`) keeps the product
 * centered; `f_auto,q_auto` ships a smaller, faster image. No-op for any URL that
 * isn't a Cloudinary delivery URL (e.g. /placeholder.webp).
 */
export function cldFill(url: string, size = 600): string {
  if (!url || !url.includes("res.cloudinary.com")) return url

  const marker = "/image/upload/"
  const i = url.indexOf(marker)
  if (i === -1) return url

  const after = url.slice(i + marker.length)
  if (after.startsWith("c_fill")) return url // already transformed

  const transform = `c_fill,g_auto,f_auto,q_auto,w_${size},h_${size}/`
  return url.slice(0, i + marker.length) + transform + after
}

/**
 * Free-form delivery: scale the image to fit inside `size` on its longest edge and
 * KEEP its natural aspect ratio — never cropped, never padded (`c_limit` only ever
 * scales down). Use this wherever the whole product/variant image must be visible
 * (PDP gallery, admin previews) rather than squared off like a grid thumbnail.
 */
export function cldFit(url: string, size = 1000): string {
  if (!url || !url.includes("res.cloudinary.com")) return url

  const marker = "/image/upload/"
  const i = url.indexOf(marker)
  if (i === -1) return url

  const after = url.slice(i + marker.length)
  if (after.startsWith("c_")) return url // already transformed

  const transform = `c_limit,f_auto,q_auto,w_${size},h_${size}/`
  return url.slice(0, i + marker.length) + transform + after
}
