import { create } from "zustand"

interface FilterState {
  page: number
  limit: number
  category?: string
  sort?: string
  search?: string

  setFilters: (data: Partial<FilterState>) => void
  resetFilters: () => void
}

const initialState = {
  page: 1,
  limit: 12,
  category: undefined,
  sort: undefined,
  search: undefined,
}

export const useProductFilterStore = create<FilterState>((set) => ({
  ...initialState,

  setFilters: (data) =>
    set((state) => ({
      ...state,
      ...data,
      page: data.page ?? 1, // reset page when filters change
    })),

  resetFilters: () => set(initialState),
}))
