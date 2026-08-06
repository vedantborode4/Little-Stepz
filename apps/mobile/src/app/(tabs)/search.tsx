import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { ProductListing } from "../../components/product/ProductListing";
import { useProductFilterStore } from "../../store/productFilter.store";

/** Shop / All Products tab — search + sort + filter over the full catalogue. */
export default function Search() {
  const filter = useProductFilterStore();
  return (
    <ScreenContainer>
      <ProductListing filter={filter} autoFocusFromHome defaultTitle="All products" />
    </ScreenContainer>
  );
}
