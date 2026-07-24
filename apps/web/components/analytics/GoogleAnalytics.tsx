import Script from "next/script"
import { GA_MEASUREMENT_ID } from "../../lib/seo/site"

/**
 * Google Analytics 4 (gtag.js), loaded on every page from the root layout.
 *
 * Uses next/script rather than raw <script> tags so Next controls injection
 * order and the loader is not re-executed on client-side navigation. The
 * `afterInteractive` strategy is the direct equivalent of the `async` attribute
 * in Google's copy-paste snippet: it loads early but never blocks first paint.
 *
 * Renders nothing when the measurement ID is unset, so local development and
 * preview builds do not pollute production analytics.
 *
 * SPA navigation is covered — verified, not assumed. `gtag('config')` sends the
 * first `page_view`, and GA4 Enhanced Measurement's "Page changes based on
 * browser history events" catches App Router client-side navigations after it.
 * Measured against a production build: initial load plus two in-app navigations
 * produced exactly three `/g/collect` hits, no duplicates.
 *
 * So do NOT add a manual `page_view` on pathname change — with Enhanced
 * Measurement on, that double-counts every navigation. Only add one if that
 * setting is ever switched off in the GA4 property.
 *
 * The hits are also not instant: they land a second or two after the route
 * changes, so a check that samples immediately after a click will read zero.
 */
export default function GoogleAnalytics() {
  if (!GA_MEASUREMENT_ID) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');`}
      </Script>
    </>
  )
}
