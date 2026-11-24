import type { Metadata } from "next"
import JsonLd from "../../../components/seo/JsonLd"
import { getProductBySlug, missingProduct } from "../../../lib/seo/catalogue"
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

  // Resolve the 404 here too: metadata is settled before the page body, so this
  // is the earliest point where the response status can still become 404.
  if (!product) return missingProduct(slug)

  return pageMetadata({
    title: product.metaTitle || productMetaTitle(product.name, product.category?.name),
    description:
      product.metaDescription ||
      productMetaDescription(
        product.description,
        product.name,
        String(product.salePrice || product.price),
      ),
    path: `/products/${slug}`,
    image: product.ogImage || product.images?.[0]?.url,
    noindex: product.noindex ?? false,
    type: "article",
  })
}

export default async function ProductLayout({
  children,
  params,
}: Props & { children: React.ReactNode }) {
  const { slug } = await params
  const product = await getProductBySlug(slug)

  if (!product) return missingProduct(slug)

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
            preOrder: !!product.preOrderEnabled,
            categoryName: product.category?.name,
            brand: product.brand,
            gtin: product.gtin,
            mpn: product.mpn,
            condition: product.condition,
          }),
          breadcrumbSchema(crumbs),
        ]}
      />
      {children}
    </>
  )
}
