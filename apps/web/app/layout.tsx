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

export const metadata = {
  title: "Little Stepz",
  description: "Toys store",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${manrope.variable} ${anton.variable} ${sora.variable} ${orbitron.variable}`}>
      <body className="font-sans">
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

        {/* Google Analytics (gtag.js) */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-EWT0G2CD9X"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-EWT0G2CD9X');
          `}
        </Script>

        <TawkWidget />
      </body>
    </html>
  )
}