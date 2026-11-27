import { notFound } from "next/navigation"

import {
  getCategoryBySlug,
  getCategoryProductsPage,
} from "../../../../lib/seo/catalogue"
import { categoryCopy } from "../../../../lib/seo/categoryCopy"
import { PRODUCTS_PER_LOAD } from "../../../../lib/utils/catalogue-paging"
import CategoryProductsView from "../../../../components/products/CategoryProductsView"

/**
 * Server shell for a category page (plan W1).
 *
 * Fetches the category and the first batch of its products on the server, then hands them
 * to the interactive island so the H1, intro passage and the first grid of
 * product links are present in the initial HTML. Filters/sort and loading more on
 * scroll stay client-side. CollectionPage/Breadcrumb JSON-LD comes from the sibling layout.
 */
type Props = { params: Promise<{ slug: string }> }

export default async function CategoryProductsPage({ params }: Props) {
  const { slug } = await params

  const [category, { products, totalPages, total }] = await Promise.all([
    getCategoryBySlug(slug),
    getCategoryProductsPage(slug, PRODUCTS_PER_LOAD),
  ])

  if (!category) notFound()

  const copy = categoryCopy(slug, category.name)

  return (
    <CategoryProductsView
      slug={slug}
      heading={copy.h1}
      intro={copy.intro}
      initialProducts={products}
      initialTotalPages={totalPages}
      initialTotal={total}
    />
  )
}
