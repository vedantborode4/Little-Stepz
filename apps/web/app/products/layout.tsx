import { pageMetadata } from "../../lib/seo/metadata"

/**
 * Metadata for /products. Child layouts (/products/[slug],
 * /products/category/[slug]) override this with their own.
 */
export const metadata = pageMetadata({
  title: "All Products — RC Cars, Diecast & More",
  description:
    "Browse the full Little Stepz catalogue — officially licensed RC cars, diecast models, Hot Wheels Premium, building blocks, insulated tumblers and more. Delivered across India.",
  path: "/products",
})

export default function ProductsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // No Suspense boundary here (audit LS-21). It used to wrap every route under
  // /products, so product and category pages streamed their shell with HTTP 200
  // before the page could call notFound(): unknown product URLs answered 200
  // instead of 404. The boundary the listing's useSearchParams() needs now lives
  // in app/products/page.tsx, around the listing only.
  return children
}
