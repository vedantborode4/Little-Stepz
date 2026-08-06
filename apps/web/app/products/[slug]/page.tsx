import { notFound } from "next/navigation"

import { getFullProductBySlug } from "../../../lib/seo/catalogue"
import ProductDetailView from "../../../components/products/details/ProductDetailView"

/**
 * Server shell for a product page (plan W1).
 *
 * Fetches the product on the server and hands it to the interactive island, so
 * the H1, description and specifications are present in the initial HTML for
 * crawlers and AI agents. Metadata + Product/Breadcrumb JSON-LD are emitted by
 * the sibling layout.tsx (same cached fetch, deduped by Next).
 */
type Props = { params: Promise<{ slug: string }> }

export default async function ProductDetailsPage({ params }: Props) {
  const { slug } = await params
  const product = await getFullProductBySlug(slug)

  if (!product) notFound()

  return <ProductDetailView product={product} />
}
