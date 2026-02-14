import { create } from "zustand"
import { Category } from "../types/category"

interface CategoryState {
  tree: Category[]
  setTree: (data: Category[]) => void
}

export const useCategoryStore = create<CategoryState>((set) => ({
  tree: [],
  setTree: (tree) => set({ tree }),
}))
