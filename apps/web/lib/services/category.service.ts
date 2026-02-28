import { api } from "../api-client"

export interface CategoryNode {
  id: string
  name: string
  slug: string
  parentId?: string | null
  children?: CategoryNode[]
}

/**
 * Builds a nested category tree from a flat list of categories.
 *
 * The backend exposes GET /categories which returns a flat array where
 * each item may have a `parentId`. There is no dedicated /categories/tree
 * endpoint — calling it returns 404. We build the tree on the client side.
 */
function buildTree(flat: CategoryNode[]): CategoryNode[] {
  const map = new Map<string, CategoryNode>()
  const roots: CategoryNode[] = []

  // First pass: index all nodes
  for (const cat of flat) {
    map.set(cat.id, { ...cat, children: [] })
  }

  // Second pass: wire up parent → children relationships
  for (const cat of map.values()) {
    if (cat.parentId) {
      const parent = map.get(cat.parentId)
      if (parent) {
        parent.children!.push(cat)
      } else {
        // Parent not found (orphaned node) — treat as root
        roots.push(cat)
      }
    } else {
      roots.push(cat)
    }
  }

  return roots
}

export const CategoryService = {
  // ✅ FIX: /categories/tree does not exist on the backend (returns 404).
  // The backend only exposes GET /categories (flat list).
  // We fetch the flat list and build the tree structure client-side.
  getTree: async (): Promise<CategoryNode[]> => {
    const res = await api.get("/categories")
    const flat: CategoryNode[] = res.data.data
    return buildTree(flat)
  },

  getAll: async (): Promise<CategoryNode[]> => {
    const res = await api.get("/categories")
    return res.data.data
  },
}
