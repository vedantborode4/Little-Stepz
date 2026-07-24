import { pageMetadata } from "../../lib/seo/metadata"

export const metadata = pageMetadata({
  title: "Your Cart",
  description: "Review the items in your Little Stepz cart before checkout.",
  path: "/cart",
  noindex: true,
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
