import "./globals.css"
import { Toaster } from "sonner"
import { AuthProvider } from "./providers/auth-provider"
import Script from "next/script"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
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
