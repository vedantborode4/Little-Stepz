import { useCallback, useMemo, useState } from "react";

import type { ProductFilterState, SortOption } from "../store/productFilter.store";

/**
 * A local, per-screen implementation of the product filter state (same shape as
 * the global `useProductFilterStore`). Lets a second listing (e.g. Pre-Order)
 * reuse `ProductListing` with its own independent search/sort/filter, without
 * sharing state with the Shop tab.
 */
export function useProductFilterState(): ProductFilterState {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [sort, setSort] = useState<SortOption>("newest");
  const [priceMin, setPriceMin] = useState<number | undefined>(undefined);
  const [priceMax, setPriceMax] = useState<number | undefined>(undefined);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [focusSearch, setFocusSearch] = useState(false);

  const setPriceRange = useCallback((min?: number, max?: number) => {
    setPriceMin(min);
    setPriceMax(max);
  }, []);

  const reset = useCallback(() => {
    setSearch("");
    setCategory(undefined);
    setSort("newest");
    setPriceMin(undefined);
    setPriceMax(undefined);
    setInStockOnly(false);
  }, []);

  return useMemo(
    () => ({
      search,
      category,
      sort,
      priceMin,
      priceMax,
      inStockOnly,
      focusSearch,
      setSearch,
      setCategory,
      setSort,
      setPriceRange,
      setInStockOnly,
      setFocusSearch,
      reset,
    }),
    [search, category, sort, priceMin, priceMax, inStockOnly, focusSearch, setPriceRange, reset]
  );
}
