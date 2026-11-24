import { Suspense } from "react"
import { getProductsPage } from "../../lib/seo/catalogue"
import ProductsListingView from "../../components/products/ProductsListingView"

/**
 * Server shell for the catalogue listing (plan W1).
 *
 * Fetches page 1 of the unfiltered catalogue on the server so the H1 and the
 * first product grid render into the initial HTML. The client island (below)
 * layers on filters, search, sorting and pagination after hydration. Metadata
 * comes from the sibling layout. The island reads useSearchParams(), which needs
 * a Suspense boundary to prerender; it is kept here, around the listing only, so
 * it no longer covers product and category pages (see app/products/layout.tsx).
 */
export default async function ProductsPage() {
  const { products, totalPages } = await getProductsPage(12)

  return (
    <Suspense>
      <ProductsListingView
        initialProducts={products}
        initialTotalPages={totalPages}
      />
    </Suspense>
  )
}
