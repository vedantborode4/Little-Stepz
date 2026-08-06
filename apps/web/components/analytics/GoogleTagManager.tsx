import Script from "next/script"
import { GTM_ID } from "../../lib/seo/site"

/**
 * Google Tag Manager, loaded on every page from the root layout.
 *
 * Mirrors <GoogleAnalytics />: next/script (`afterInteractive`) so Next controls
 * injection order and the loader is not re-executed on client-side navigation.
 *
 * IMPORTANT: GA4 is already loaded directly via <GoogleAnalytics /> (gtag.js).
 * Do NOT also add a GA4 tag inside this GTM container — that double-counts every
 * hit. Use this container for other tags (Ads, Pixel, custom events) instead.
 *
 * The loader goes in <head>; the <noscript> fallback (GoogleTagManagerNoScript)
 * must be rendered as the first child of <body>.
 */
export default function GoogleTagManager() {
  if (!GTM_ID) return null

  return (
    <Script id="gtm-loader" strategy="afterInteractive">
      {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
    </Script>
  )
}

/** GTM <noscript> fallback — render as the first child of <body>. */
export function GoogleTagManagerNoScript() {
  if (!GTM_ID) return null

  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
        title="Google Tag Manager"
      />
    </noscript>
  )
}
