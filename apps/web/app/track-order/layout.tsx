import { pageMetadata } from "../../lib/seo/metadata"

export const metadata = pageMetadata({
  title: "Track your order",
  description: "Check the status of your Little Stepz order with your order number and email or phone.",
  path: "/track-order",
  noindex: true,
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
