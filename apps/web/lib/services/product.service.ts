import { api } from "../api-client"
import { Product } from "../../types/product"

export const ProductService = {
  getProducts: async (params?: any) => {
    const res = await api.get<Product[]>("/products", { params })
    return res.data
  },

  getBySlug: async (slug: string) => {
    const res = await api.get<Product>(`/products/${slug}`)
    return res.data
  },
}
