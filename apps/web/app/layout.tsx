import "./globals.css"
import { Plus_Jakarta_Sans } from "next/font/google"
import { Toaster } from "sonner"
import Script from "next/script"

import { AuthProvider } from "./providers/auth-provider"
import Navbar from "../components/layout/Navbar"
import Footer from "../components/layout/Footer"

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
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
    <html lang="en" className={plusJakarta.variable}>
      <body className="font-sans">
        <AuthProvider>
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