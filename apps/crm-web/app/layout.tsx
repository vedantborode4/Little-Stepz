import "./globals.css"
import type { Metadata } from "next"
import { Manrope, Sora } from "next/font/google"
import Providers from "./providers"

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" })
const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap" })

export const metadata: Metadata = {
  title: { default: "Little Stepz CRM", template: "%s · Little Stepz CRM" },
  description: "Private business management for Little Stepz",
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" suppressHydrationWarning className={`${manrope.variable} ${sora.variable}`}>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
