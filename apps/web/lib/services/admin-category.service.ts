import { api } from "../api-client"
import type {
  CreateCategoryData,
  UpdateCategoryData,
} from "@repo/zod-schema/index"

export interface AdminCategory {
  id: string
  name: string
  slug: string
  description?: string
  parentId?: string | null
}

export const AdminCategoryService = {
  getAll: async (): Promise<AdminCategory[]> => {
    const res = await api.get("/categories")
    return res.data.data
  },

  create: async (data: CreateCategoryData): Promise<AdminCategory> => {
    const res = await api.post("/admin/categories", data)
    return res.data.data
  },

  update: async (
    id: string,
    data: UpdateCategoryData
  ): Promise<AdminCategory> => {
    const res = await api.put(`/admin/categories/${id}`, data)
    return res.data.data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/admin/categories/${id}`)
  },
}