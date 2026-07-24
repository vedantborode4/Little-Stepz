import { ImageResponse } from "next/og"
import { BRAND, TAGLINE } from "../lib/seo/site"

/**
 * Default social preview card, generated at the edge rather than shipped as a
 * static JPEG — no design asset to commission, and it cannot go stale when the
 * tagline changes.
 *
 * Product pages override this with the product photo (see products/[slug]/layout.tsx).
 */

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = `${BRAND} — ${TAGLINE}`

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #1a1a1a 0%, #2d1618 55%, #7f1d1d 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 30,
            letterSpacing: 8,
            textTransform: "uppercase",
            color: "#fca5a5",
            display: "flex",
          }}
        >
          littlestepz.in
        </div>

        <div
          style={{
            fontSize: 92,
            fontWeight: 800,
            marginTop: 20,
            lineHeight: 1.05,
            display: "flex",
          }}
        >
          {BRAND}
        </div>

        <div
          style={{
            fontSize: 40,
            marginTop: 28,
            lineHeight: 1.3,
            color: "#e5e5e5",
            maxWidth: 900,
            display: "flex",
          }}
        >
          {TAGLINE}
        </div>

        <div
          style={{
            marginTop: 44,
            fontSize: 27,
            color: "#d4d4d4",
            display: "flex",
          }}
        >
          RC Cars · Diecast · Hot Wheels · Building Blocks · Collectibles
        </div>
      </div>
    ),
    size,
  )
}
