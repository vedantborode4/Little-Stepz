import { pageMetadata } from "../../lib/seo/metadata"

export const metadata = pageMetadata({
  title: "Checkout",
  description: "Complete your Little Stepz order securely.",
  path: "/checkout",
  noindex: true,
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
