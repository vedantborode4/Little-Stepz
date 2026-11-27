import { getProductsPage } from "../../lib/seo/catalogue"
import { PRODUCTS_PER_LOAD } from "../../lib/utils/catalogue-paging"
import ProductsListingView from "../../components/products/ProductsListingView"

/**
 * Server shell for the catalogue listing (plan W1).
 *
 * Fetches the first batch of the unfiltered catalogue on the server so the H1 and
 * the first product grid render into the initial HTML. The client island (below)
 * layers on filters, search, sorting and loading more as the shopper scrolls.
 * Metadata comes from the sibling layout, which also provides the Suspense
 * boundary that the island's useSearchParams() needs.
 */
export default async function ProductsPage() {
  const { products, totalPages, total } = await getProductsPage(PRODUCTS_PER_LOAD)

  return (
    <ProductsListingView
      initialProducts={products}
      initialTotalPages={totalPages}
      initialTotal={total}
    />
  )
}
