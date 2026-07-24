import { Suspense } from "react"
import { pageMetadata } from "../../lib/seo/metadata"

/**
 * Metadata for /products. Child layouts (/products/[slug],
 * /products/category/[slug]) override this with their own.
 */
export const metadata = pageMetadata({
  title: "All Products — RC Cars, Diecast & More",
  description:
    "Browse the full Little Stepz catalogue — officially licensed RC cars, diecast models, Hot Wheels Premium, building blocks, Stanley tumblers and more. Delivered across India.",
  path: "/products",
})

export default function ProductsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // The listing page reads useSearchParams() for filter/sort/page state, which
  // needs a Suspense boundary to prerender — without one the build throws and
  // the route falls back to fully client-side rendering, undoing the SSR win.
  return <Suspense>{children}</Suspense>
}
