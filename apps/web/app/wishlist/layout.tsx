import { pageMetadata } from "../../lib/seo/metadata"

export const metadata = pageMetadata({
  title: "Your Wishlist",
  description: "Products you have saved at Little Stepz.",
  path: "/wishlist",
  noindex: true,
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
