import { api } from "../api-client"

export interface CategoryNode {
  id: string
  name: string
  slug: string
  children?: CategoryNode[]
}

export const CategoryService = {
  getTree: async (): Promise<CategoryNode[]> => {
    const res = await api.get("/categories/tree")
    return res.data.data
  },

  getAll: async (): Promise<CategoryNode[]> => {
    const res = await api.get("/categories")
    return res.data.data
  },
}
