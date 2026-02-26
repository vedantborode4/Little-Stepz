import { api } from "../api-client"

export const AdminProductService = {
  /* ---------- LIST (uses public products API) ---------- */
  getProducts: async (params?: any) => {
    const res = await api.get("/products", { params })
    return res.data.data
  },

  /* ---------- CRUD ---------- */
  createProduct: async (payload: any) => {
    const res = await api.post("/admin/products", payload)
    return res.data.data
  },

  updateProduct: async (id: string, payload: any) => {
    const res = await api.put(`/admin/products/${id}`, payload)
    return res.data.data
  },

  deleteProduct: async (id: string) => {
    const res = await api.delete(`/admin/products/${id}`)
    return res.data.data
  },
}