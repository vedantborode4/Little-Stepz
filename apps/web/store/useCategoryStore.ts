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
    set({ isLoading: true, error: null })
    try {
      const data = await CategoryService.getTree()
      set({ tree: data })
    } catch (err: any) {
      // ✅ FIX: previously errors were silently swallowed in the finally block.
      // Now we surface them so UI can react and developers can debug.
      const message = err?.response?.data?.message ?? err?.message ?? "Failed to load categories"
      set({ error: message })
      console.error("[CategoryStore] fetchTree failed:", message)
    } finally {
      set({ isLoading: false })
    }
  },

  fetchFlatCategories: async () => {
    set({ isLoading: true, error: null })
    try {
      const data = await CategoryService.getAll()
      set({ flatCategories: data })
    } catch (err: any) {
      const message = err?.response?.data?.message ?? err?.message ?? "Failed to load categories"
      set({ error: message })
      console.error("[CategoryStore] fetchFlatCategories failed:", message)
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
