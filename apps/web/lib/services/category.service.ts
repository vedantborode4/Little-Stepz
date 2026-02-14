import { api } from "../api-client"
import { Category } from "../../types/category"

export const CategoryService = {
  getTree: async () => {
    const res = await api.get<Category[]>("/categories/tree")
    return res.data
  },
}
