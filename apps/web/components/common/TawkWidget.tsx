"use client"

import Script from "next/script"
import { usePathname } from "next/navigation"
import { useEffect } from "react"

const PROPERTY_ID = process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID
const WIDGET_ID = process.env.NEXT_PUBLIC_TAWK_WIDGET_ID

// Customer chat has no place in the staff admin panel.
const HIDDEN_PREFIXES = ["/admin"]

declare global {
  interface Window {
    Tawk_API?: {
      showWidget?: () => void
      hideWidget?: () => void
      onLoad?: () => void
    }
    Tawk_LoadStart?: Date
  }
}

/**
 * tawk.to live-chat widget (anonymous). Property/Widget IDs are public embed
 * identifiers, so they ship in the client bundle by design — there is no secret.
 * The script loads once (lazyOnload) and is hidden/shown by route rather than
 * unmounted, since tawk injects its own iframe outside React's tree.
 */
export default function TawkWidget() {
  const pathname = usePathname()
  const hidden = HIDDEN_PREFIXES.some((p) => pathname?.startsWith(p))

  useEffect(() => {
    if (hidden) window.Tawk_API?.hideWidget?.()
    else window.Tawk_API?.showWidget?.()
  }, [hidden])

  if (!PROPERTY_ID || !WIDGET_ID) return null

  return (
    <>
      <Script id="tawk-init" strategy="lazyOnload">
        {`window.Tawk_API=window.Tawk_API||{};window.Tawk_LoadStart=new Date();${
          hidden ? "window.Tawk_API.onLoad=function(){window.Tawk_API.hideWidget&&window.Tawk_API.hideWidget();};" : ""
        }`}
      </Script>
      <Script
        id="tawk-widget"
        strategy="lazyOnload"
        src={`https://embed.tawk.to/${PROPERTY_ID}/${WIDGET_ID}`}
        crossOrigin="anonymous"
      />
    </>
  )
}
