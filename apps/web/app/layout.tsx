import "./globals.css"
import { Toaster } from "sonner"

export default function RootLayout({ children }: any) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster richColors />
      </body>
    </html>
  )
}
