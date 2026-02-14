import { create } from "zustand"

interface FilterState {
  category?: string
  sort?: string
  setFilter: (data: Partial<FilterState>) => void
}

export const useProductFilterStore = create<FilterState>((set) => ({
  setFilter: (data) => set(data),
}))
