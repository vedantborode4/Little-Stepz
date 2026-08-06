import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { getFullProductBySlug } from "../../../lib/seo/catalogue"
import PreOrderCheckoutView from "../../../components/preorder/PreOrderCheckoutView"

/**
 * Server shell for the pre-order checkout (plan W1).
 *
 * Fetches the product on the server so the summary is in the initial HTML, then
 * hands it to the interactive island (address + Razorpay booking). noindex — a
 * transactional checkout page should not be indexed. The Suspense boundary
 * covers the island's useSearchParams().
 */
export const metadata: Metadata = {
  title: "Pre-Order",
  robots: { index: false, follow: true },
}

type Props = { params: Promise<{ slug: string }> }

export default async function PreOrderCheckoutPage({ params }: Props) {
  const { slug } = await params
  const product = await getFullProductBySlug(slug)

  if (!product) notFound()

  return (
    <Suspense>
      <PreOrderCheckoutView product={product} />
    </Suspense>
  )
}
