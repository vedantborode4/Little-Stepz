import { api } from "../api-client"

export interface AdminCategory {
  id: string
  name: string
  slug: string
  parentId?: string | null
  image?: string | null
  createdAt?: string
}

function buildTree(flat: AdminCategory[]): AdminCategory[] {
  // Returns flat list with children attached — kept flat for admin use
  return flat
}

export const AdminCategoryService = {
  /** GET /categories — returns flat list */
  getAll: async (): Promise<AdminCategory[]> => {
    const res = await api.get("/categories")
    const d = res.data.data
    return Array.isArray(d) ? d : d.categories ?? []
  },

  /**
   * GET /categories (flat) — /categories/tree returns 500 on this backend.
   * We fetch the flat list instead; callers that needed a tree can build it client-side.
   */
  getTree: async (): Promise<AdminCategory[]> => {
    const res = await api.get("/categories")
    const d = res.data.data
    return Array.isArray(d) ? d : d.categories ?? []
  },

  /** POST /admin/categories  body: { name, slug, parentId?, image? } */
  create: async (body: { name: string; slug: string; parentId?: string; image?: string }): Promise<AdminCategory> => {
    const res = await api.post("/admin/categories", body)
    return res.data.data
  },

  /**
   * PUT /admin/categories/:id
   * To clear a parent (set to no parent), pass parentId: null explicitly.
   */
  update: async (id: string, body: { name?: string; slug?: string; parentId?: string | null; image?: string }): Promise<AdminCategory> => {
    const res = await api.put(`/admin/categories/${id}`, body)
    return res.data.data
  },

  /** DELETE /admin/categories/:id */
  delete: async (id: string) => {
    await api.delete(`/admin/categories/${id}`)
  },
}
