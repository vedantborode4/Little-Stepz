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
  page: number
  category?: string
  sort?: string
  priceMin?: number
  priceMax?: number
  search?: string

  setFilters: (data: Partial<FilterState>) => void
  resetFilters: () => void
}

export const useProductFilterStore = create<FilterState>((set) => ({
  page: 1,
  category: undefined,
  sort: undefined,
  priceMin: undefined,
  priceMax: undefined,
  search: "",

  setFilters: (data) =>
    set((state) => ({
      ...state,
      ...data,
      page: data.page ?? 1,
    })),

  resetFilters: () =>
    set({
      page: 1,
      category: undefined,
      sort: undefined,
      priceMin: undefined,
      priceMax: undefined,
      search: "",
    }),
}))
