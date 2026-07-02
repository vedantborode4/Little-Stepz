import { create } from "zustand"

export interface ProductFilterValues {
  page: number
  category?: string
  sort?: string
  priceMin?: number
  priceMax?: number
  search?: string
}

export interface FilterState {
  // ── Applied values (drive the product fetch) ──
  page: number
  category?: string
  sort?: string
  priceMin?: number
  priceMax?: number
  search?: string

  // ── Draft values (batched; committed via applyDraft) ──
  draftSort?: string
  draftPriceMin?: number
  draftPriceMax?: number

  /** Apply values immediately (search, pagination, category, URL hydration). */
  setFilters: (data: Partial<FilterState>) => void
  /** Update only the pending draft (Sort/Price controls) — does NOT refetch. */
  setDraft: (
    data: Partial<Pick<FilterState, "draftSort" | "draftPriceMin" | "draftPriceMax">>
  ) => void
  /** Commit the draft (sort + price) to the applied filters — this is the one refetch. */
  applyDraft: () => void
  resetFilters: () => void
}

export const useProductFilterStore = create<FilterState>((set) => ({
  page: 1,
  category: undefined,
  sort: undefined,
  priceMin: undefined,
  priceMax: undefined,
  search: "",

  draftSort: undefined,
  draftPriceMin: undefined,
  draftPriceMax: undefined,

  setFilters: (data) =>
    set((state) => ({
      ...state,
      ...data,
      page: data.page ?? 1,
      // Keep the draft mirrored to applied when sort/price are set directly
      // (URL hydration, Clear) so the controls reflect the current filters.
      ...("sort" in data ? { draftSort: data.sort } : {}),
      ...("priceMin" in data ? { draftPriceMin: data.priceMin } : {}),
      ...("priceMax" in data ? { draftPriceMax: data.priceMax } : {}),
    })),

  setDraft: (data) => set((state) => ({ ...state, ...data })),

  applyDraft: () =>
    set((state) => ({
      ...state,
      sort: state.draftSort,
      priceMin: state.draftPriceMin,
      priceMax: state.draftPriceMax,
      page: 1,
    })),

  resetFilters: () =>
    set({
      page: 1,
      category: undefined,
      sort: undefined,
      priceMin: undefined,
      priceMax: undefined,
      search: "",
      draftSort: undefined,
      draftPriceMin: undefined,
      draftPriceMax: undefined,
    }),
}))
