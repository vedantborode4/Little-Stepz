import { create } from "zustand"
import { CategoryService, CategoryNode } from "../lib/services/category.service"

interface CategoryState {
  tree: CategoryNode[]
  isLoading: boolean
  fetchTree: () => Promise<void>
}

export const useCategoryStore = create<CategoryState>((set) => ({
  tree: [],
  isLoading: false,

  fetchTree: async () => {
    set({ isLoading: true })

    try {
      const data = await CategoryService.getTree()
      set({ tree: data })
    } finally {
      set({ isLoading: false })
    }
  },
}))
