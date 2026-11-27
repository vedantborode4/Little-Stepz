import { pageMetadata } from "../../../../lib/seo/metadata"

export const metadata = pageMetadata({
  title: "Your order",
  description: "View, track and manage your Little Stepz order.",
  path: "/orders/view",
  noindex: true,
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
