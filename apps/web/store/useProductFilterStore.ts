import { create } from "zustand"

interface FilterState {
  category?: string
  sort?: string
  page: number

  setFilter: (data: Partial<FilterState>) => void
}

export const useProductFilterStore = create<FilterState>((set) => ({
  page: 1,

  setFilter: (data) =>
    set((state) => ({
      ...state,
      ...data,
    })),
}))
