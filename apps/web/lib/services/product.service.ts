import { api } from "../api-client"
import { Product } from "../../types/product"

export interface GetProductsParams {
  page?: number
  limit?: number
  category?: string
  search?: string
  sort?: string
  priceMax?: number  
}

interface BackendResponse {
  status: string
  message: string
  data: {
    products: Product[]
    total: number
    page: number
    limit: number
    pages: number
  }
}

export interface PaginatedProducts {
  data: Product[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export const ProductService = {
  getProducts: async (
    params?: GetProductsParams
  ): Promise<PaginatedProducts> => {
    const res = await api.get<BackendResponse>("/products", { params })

    return {
      data: res.data.data.products,
      meta: {
        total: res.data.data.total,
        page: res.data.data.page,
        limit: res.data.data.limit,
        totalPages: res.data.data.pages,
      },
    }
  },

  getBySlug: async (slug: string) => {
    const res = await api.get(`/products/${slug}`)
    return res.data.data
  },
}
