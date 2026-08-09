import type { Metadata } from "next"
import JsonLd from "../../../../components/seo/JsonLd"
import { getCategoryBySlug, getProductsByCategory } from "../../../../lib/seo/catalogue"
import { categoryCopy } from "../../../../lib/seo/categoryCopy"
import { pageMetadata } from "../../../../lib/seo/metadata"
import { breadcrumbSchema, collectionPageSchema } from "../../../../lib/seo/schema"

/**
 * Per-category metadata and CollectionPage/Breadcrumb JSON-LD (proposal §4.3).
 *
 * Empty categories are marked noindex,follow — a category page with no products
 * is thin content and indexing it earns a "crawled, currently not indexed" in
 * Search Console. sitemap.ts filters them out on the same rule.
 */

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const [category, products] = await Promise.all([
    getCategoryBySlug(slug),
    getProductsByCategory(slug),
  ])

  if (!category) {
    return { title: "Category not found", robots: { index: false, follow: true } }
  }

  const copy = categoryCopy(slug, category.name)

  return pageMetadata({
    title: category.metaTitle || copy.title,
    description: category.metaDescription || copy.description,
    path: `/products/category/${slug}`,
    image: category.ogImage || undefined,
    noindex: (category.noindex ?? false) || products.length === 0,
  })
}

export default async function CategoryLayout({
  children,
  params,
}: Props & { children: React.ReactNode }) {
  const { slug } = await params
  const [category, products] = await Promise.all([
    getCategoryBySlug(slug),
    getProductsByCategory(slug),
  ])

  if (!category) return <>{children}</>

  const copy = categoryCopy(slug, category.name)

  return (
    <>
      <JsonLd
        schema={[
          collectionPageSchema({
            name: copy.h1,
            description: copy.intro,
            path: `/products/category/${slug}`,
            items: products.map((p) => ({ name: p.name, slug: p.slug })),
          }),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Products", path: "/products" },
            { name: category.name, path: `/products/category/${slug}` },
          ]),
        ]}
      />
      {children}
    </>
  )
}
