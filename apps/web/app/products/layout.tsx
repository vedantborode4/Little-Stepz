import Footer from "../../components/layout/Footer"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>

            {children}
        <Footer />
      </body>
    </html>
  )
}
