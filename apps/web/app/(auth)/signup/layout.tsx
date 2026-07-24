import { pageMetadata } from "../../../lib/seo/metadata"

export const metadata = pageMetadata({
  title: "Create an Account",
  description: "Create a Little Stepz account to check out faster and track your orders.",
  path: "/signup",
  noindex: true,
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
