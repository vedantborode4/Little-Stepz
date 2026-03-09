import { create } from "zustand"
import { CategoryService, CategoryNode } from "../lib/services/category.service"

interface CategoryState {
  tree: CategoryNode[]
  flatCategories: CategoryNode[]
  categoryPath: CategoryNode[]
  isLoading: boolean
  error: string | null

  fetchTree: () => Promise<void>
  fetchFlatCategories: () => Promise<void>
  setCategoryPath: (slug: string) => void
}

export const useCategoryStore = create<CategoryState>((set, get) => ({
  tree: [],
  flatCategories: [],
  categoryPath: [],
  isLoading: false,
  error: null,

  fetchTree: async () => {
    if (get().tree.length > 0) return
    set({ isLoading: true, error: null })
    try {
      const data = await CategoryService.getTree()
      set({ tree: data })
    } catch {
      // GET /categories failed — try fetching flat list as fallback
      try {
        const flat = await CategoryService.getAll()
        // Store flat list as the tree (no nesting) — better than nothing
        set({ tree: flat })
      } catch {
        // Both attempts failed — silent, non-fatal
        set({ tree: [] })
      }
    } finally {
      set({ isLoading: false })
    }
  },

  fetchFlatCategories: async () => {
    if (get().flatCategories.length > 0) return
    set({ isLoading: true, error: null })
    try {
      const data = await CategoryService.getAll()
      set({ flatCategories: data })
    } catch {
      set({ flatCategories: [] })
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
