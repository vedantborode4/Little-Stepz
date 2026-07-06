import "./globals.css"
import { Anton, Manrope, Sora, Orbitron } from "next/font/google"
import { Toaster } from "sonner"
import Script from "next/script"

import { AuthProvider } from "./providers/auth-provider"
import Navbar from "../components/layout/Navbar"
import Footer from "../components/layout/Footer"
import NumberInputWheelGuard from "../components/common/NumberInputWheelGuard"

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
    <html lang="en" className={`${manrope.variable} ${anton.variable} ${sora.variable} ${orbitron.variable}`}>
      <body className="font-sans">
        <AuthProvider>
          <NumberInputWheelGuard />
          <Navbar />
          <main>{children}</main>
          <Footer />
          <Toaster richColors />
        </AuthProvider>

        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  )
}