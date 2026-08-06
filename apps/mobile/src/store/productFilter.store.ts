import { create } from "zustand";

export type SortOption =
  | "newest"
  | "oldest"
  | "price_asc"
  | "price_desc"
  | "name_asc"
  | "name_desc";

export interface ProductFilterState {
  search: string;
  category?: string;
  sort: SortOption;
  priceMin?: number;
  priceMax?: number;
  inStockOnly: boolean;
  /** Set true to request the search input auto-focus when the Shop tab opens. */
  focusSearch: boolean;

  setSearch: (v: string) => void;
  setCategory: (slug?: string) => void;
  setSort: (s: SortOption) => void;
  setPriceRange: (min?: number, max?: number) => void;
  setInStockOnly: (v: boolean) => void;
  setFocusSearch: (v: boolean) => void;
  reset: () => void;
}

export const useProductFilterStore = create<ProductFilterState>((set) => ({
  search: "",
  category: undefined,
  sort: "newest",
  priceMin: undefined,
  priceMax: undefined,
  inStockOnly: false,
  focusSearch: false,

  setSearch: (v) => set({ search: v }),
  setCategory: (slug) => set({ category: slug }),
  setSort: (s) => set({ sort: s }),
  setPriceRange: (min, max) => set({ priceMin: min, priceMax: max }),
  setInStockOnly: (v) => set({ inStockOnly: v }),
  setFocusSearch: (v) => set({ focusSearch: v }),
  reset: () =>
    set({
      search: "",
      category: undefined,
      sort: "newest",
      priceMin: undefined,
      priceMax: undefined,
      inStockOnly: false,
    }),
}));
