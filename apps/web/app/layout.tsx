import "./globals.css"
import { Anton, Manrope, Sora, Orbitron } from "next/font/google"
import Script from "next/script"

import { AuthProvider } from "./providers/auth-provider"
import { ThemeProvider } from "./providers/theme-provider"
import Navbar from "../components/layout/Navbar"
import Footer from "../components/layout/Footer"
import NumberInputWheelGuard from "../components/common/NumberInputWheelGuard"
import ThemedToaster from "../components/common/ThemedToaster"
import LoadingScreen from "../components/common/LoadingScreen"
import TawkWidget from "../components/common/TawkWidget"
import GoogleAnalytics from "../components/analytics/GoogleAnalytics"
import GoogleTagManager, { GoogleTagManagerNoScript } from "../components/analytics/GoogleTagManager"
import JsonLd from "../components/seo/JsonLd"
import { ROOT_METADATA } from "../lib/seo/metadata"
import { organizationSchema, websiteSchema } from "../lib/seo/schema"

// Display headings
const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
})

// Body / sub-headings / navigation
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
})

// Buttons
const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
})

// Retained for product price display
const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
  display: "swap",
})

export const metadata = ROOT_METADATA

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${manrope.variable} ${anton.variable} ${sora.variable} ${orbitron.variable}`}>
      <head>
        {/* Google Tag Manager — loader placed as high in <head> as possible. */}
        <GoogleTagManager />
        {/* Google tag (gtag.js) — every page, all routes. Replaces the previous
            inline snippet with a single component so the same measurement ID is
            never loaded twice. */}
        <GoogleAnalytics />
      </head>
      <body className="font-sans">
        {/* Google Tag Manager (noscript) — must be the first element in <body>. */}
        <GoogleTagManagerNoScript />
        {/* Site-wide entity graph. Server-rendered so it is in the initial HTML. */}
        <JsonLd schema={[organizationSchema(), websiteSchema()]} />
        <ThemeProvider>
          <AuthProvider>
            <NumberInputWheelGuard />
            <LoadingScreen />
            <Navbar />
            <main>{children}</main>
            <Footer />
            <ThemedToaster />
          </AuthProvider>
        </ThemeProvider>

        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="afterInteractive"
        />

        <TawkWidget />
      </body>
    </html>
  )
}
