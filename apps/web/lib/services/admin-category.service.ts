import { api } from "../api-client"

export interface AdminCategory {
  id: string
  name: string
  slug: string
  parentId?: string | null
  image?: string | null
  createdAt?: string
}

export const AdminCategoryService = {
  /** GET /categories — returns flat list */
  getAll: async (): Promise<AdminCategory[]> => {
    const res = await api.get("/categories")
    const d = res.data.data
    return Array.isArray(d) ? d : d.categories ?? []
  },

  /** GET /categories/tree */
  getTree: async () => {
    const res = await api.get("/categories/tree")
    return res.data.data
  },

  /** POST /admin/categories  body: { name, slug, parentId?, image? } */
  create: async (body: { name: string; slug: string; parentId?: string; image?: string }): Promise<AdminCategory> => {
    const res = await api.post("/admin/categories", body)
    return res.data.data
  },

  /** PUT /admin/categories/:id  body: { name?, slug?, parentId?, image? } */
  update: async (id: string, body: { name?: string; slug?: string; parentId?: string | null; image?: string }): Promise<AdminCategory> => {
    const res = await api.put(`/admin/categories/${id}`, body)
    return res.data.data
  },

  /** DELETE /admin/categories/:id */
  delete: async (id: string) => {
    await api.delete(`/admin/categories/${id}`)
  },
}
