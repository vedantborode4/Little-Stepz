import "./globals.css"
import { Toaster } from "sonner"
import { AuthProvider } from "./providers/auth-provider"

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
        </AuthProvider>
      </body>
    </html>
  )
}
