import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { ProductListing } from "../../components/product/ProductListing";
import { useProductFilterState } from "../../hooks/useProductFilterState";

/**
 * Bottom-tab "Pre-Order" — a listing of products available to pre-order, with
 * the same search + sort + filter header as the Shop tab (its own state).
 */
export default function PreOrdersTab() {
  const filter = useProductFilterState();
  return (
    <ScreenContainer>
      <ProductListing
        filter={filter}
        basePreOrder
        defaultTitle="Pre-Order"
        subtitle="Reserve upcoming & out-of-stock items"
      />
    </ScreenContainer>
  );
}
