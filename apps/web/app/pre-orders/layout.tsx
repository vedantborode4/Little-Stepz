import { pageMetadata } from "../../lib/seo/metadata"

export const metadata = pageMetadata({
  title: "Pre-Order — Reserve Upcoming Stock",
  description:
    "Reserve upcoming Little Stepz stock before it lands. Pay a booking amount to secure limited-run RC cars, diecast models and collectibles, and settle the balance on arrival.",
  path: "/pre-orders",
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
