import { create } from "zustand"

export interface ProductFilterValues {
  page: number
  category?: string
  sort?: string
  priceMax?: number
  search?: string
}
export interface FilterState {
  page: number
  category?: string
  sort?: string
  priceMax?: number
  search?: string   // ✅ ADD THIS

  setFilters: (data: Partial<FilterState>) => void
  resetFilters: () => void
}


export const useProductFilterStore = create<FilterState>((set) => ({
  page: 1,
  category: undefined,
  sort: undefined,
  priceMax: undefined,
  search: "",

  setFilters: (data) =>
    set((state) => ({
      ...state,
      ...data,

      // reset page when any filter (except page) changes
      page: data.page ?? 1,
    })),

  resetFilters: () =>
    set({
      page: 1,
      category: undefined,
      sort: undefined,
      priceMax: undefined,
      search: "",
    }),
}))
