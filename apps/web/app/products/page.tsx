import { getProductsPage } from "../../lib/seo/catalogue"
import ProductsListingView from "../../components/products/ProductsListingView"

/**
 * Server shell for the catalogue listing (plan W1).
 *
 * Fetches page 1 of the unfiltered catalogue on the server so the H1 and the
 * first product grid render into the initial HTML. The client island (below)
 * layers on filters, search, sorting and pagination after hydration. Metadata
 * comes from the sibling layout, which also provides the Suspense boundary that
 * the island's useSearchParams() needs.
 */
export default async function ProductsPage() {
  const { products, totalPages } = await getProductsPage(12)

  return (
    <ProductsListingView
      initialProducts={products}
      initialTotalPages={totalPages}
    />
  )
}
