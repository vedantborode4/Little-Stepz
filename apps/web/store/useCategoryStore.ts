import { create } from "zustand"
import { CategoryService, CategoryNode } from "../lib/services/category.service"

interface CategoryState {
  tree: CategoryNode[]
  flatCategories: CategoryNode[] 
  categoryPath: CategoryNode[]
  isLoading: boolean

  fetchTree: () => Promise<void>
  fetchFlatCategories: () => Promise<void>   
  setCategoryPath: (slug: string) => void
}

export const useCategoryStore = create<CategoryState>((set, get) => ({
  tree: [],
  flatCategories: [],
  categoryPath: [],
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

  fetchFlatCategories: async () => {
    set({ isLoading: true })
    try {
      const data = await CategoryService.getAll()
      set({ flatCategories: data })
    } finally {
      set({ isLoading: false })
    }
  },

  setCategoryPath: (slug: string) => {
    const findPath = (
      nodes: CategoryNode[],
      target: string,
      path: CategoryNode[] = []
    ): CategoryNode[] | null => {
      for (const node of nodes) {
        const newPath = [...path, node]

        if (node.slug === target) return newPath

        if (node.children?.length) {
          const result = findPath(node.children, target, newPath)
          if (result) return result
        }
      }
      return null
    }

    const path = findPath(get().tree, slug)
    set({ categoryPath: path || [] })
  },
}))