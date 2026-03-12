import "./globals.css"
import { Toaster } from "sonner"
import { AuthProvider } from "./providers/auth-provider"
import Script from "next/script"
import Navbar from "../components/layout/Navbar"
import Footer from "../components/layout/Footer"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Navbar />
          {children}
          <Footer />
          <Toaster richColors />
          <Script
            src="https://checkout.razorpay.com/v1/checkout.js"
            strategy="afterInteractive"
          />
        </AuthProvider>
      </body>
    </html>
  )
}
