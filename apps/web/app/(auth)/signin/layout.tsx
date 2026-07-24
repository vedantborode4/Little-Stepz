import { pageMetadata } from "../../../lib/seo/metadata"

export const metadata = pageMetadata({
  title: "Sign In",
  description: "Sign in to your Little Stepz account to track orders and manage your wishlist.",
  path: "/signin",
  noindex: true,
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
