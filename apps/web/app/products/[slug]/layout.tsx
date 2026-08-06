import type { Metadata } from "next"
import JsonLd from "../../../components/seo/JsonLd"
import { getProductBySlug } from "../../../lib/seo/catalogue"
import {
  pageMetadata,
  productMetaDescription,
  productMetaTitle,
} from "../../../lib/seo/metadata"
import { breadcrumbSchema, productSchema } from "../../../lib/seo/schema"

/**
 * Per-product metadata and Product/Breadcrumb JSON-LD.
 *
 * The page itself is now a server component (plan W1) that renders the H1,
 * description and specs into the initial HTML. This layout keeps the metadata
 * and structured data (proposal §4.2 and §4.4); its getProductBySlug shares the
 * same cached fetch as the page, so there is only one network call per request.
 */

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)

  if (!product) {
    return { title: "Product not found", robots: { index: false, follow: true } }
  }

  return pageMetadata({
    title: productMetaTitle(product.name, product.category?.name),
    description: productMetaDescription(
      product.description,
      product.name,
      String(product.salePrice || product.price),
    ),
    path: `/products/${slug}`,
    image: product.images?.[0]?.url,
    type: "article",
  })
}

export default async function ProductLayout({
  children,
  params,
}: Props & { children: React.ReactNode }) {
  const { slug } = await params
  const product = await getProductBySlug(slug)

  if (!product) return <>{children}</>

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Products", path: "/products" },
    ...(product.category
      ? [
          {
            name: product.category.name,
            path: `/products/category/${product.category.slug}`,
          },
        ]
      : []),
    { name: product.name, path: `/products/${slug}` },
  ]

  return (
    <>
      <JsonLd
        schema={[
          productSchema({
            name: product.name,
            slug,
            description: product.description,
            images: (product.images ?? []).map((i) => i.url).filter(Boolean),
            price: product.price,
            salePrice: product.salePrice,
            inStock: product.inStock,
            categoryName: product.category?.name,
            // TODO: swap to product.brand once the Product model gains the field
            // (plan §3). Until then Merchant Center cannot consume this feed.
            brand: null,
          }),
          breadcrumbSchema(crumbs),
        ]}
      />
      {children}
    </>
  )
}
