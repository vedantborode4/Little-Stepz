import { api } from "../api-client"

import type {
  CreateProductData,
  UpdateProductData,
  CreateVariantBody,
  UpdateVariantBody,
} from "@repo/zod-schema/index"

/* ----------------------------- RESPONSE TYPES ----------------------------- */

export interface AdminProduct {
  id: string
  name: string
  slug: string
  description?: string
  price: number
  quantity: number
  inStock: boolean

  category?: {
    id: string
    name: string
    slug: string
  }

  images?: {
    id: string
    url: string
    alt?: string
    sortOrder: number
  }[]

  variants?: {
    id: string
    name: string
    price?: number | null
    stock?: number
  }[]

  createdAt: string
  updatedAt: string
}

type Variant = NonNullable<AdminProduct["variants"]>[number]

interface ProductListResponse {
  products: AdminProduct[]
  total: number
  page: number
  limit: number
  pages: number
}

/* -------------------------------------------------------------------------- */

export const AdminProductService = {
  /* ---------- LIST ---------- */

  getProducts: async (
    params?: Record<string, unknown>
  ): Promise<ProductListResponse> => {
    const res = await api.get("/products", { params })
    return res.data.data
  },

  /* ---------- PRODUCT CRUD ---------- */

  createProduct: async (
    payload: CreateProductData
  ): Promise<AdminProduct> => {
    const res = await api.post("/admin/products", payload)
    return res.data.data
  },

  updateProduct: async (
    id: string,
    payload: UpdateProductData
  ): Promise<AdminProduct> => {
    const res = await api.put(`/admin/products/${id}`, payload)
    return res.data.data
  },

  deleteProduct: async (id: string): Promise<void> => {
    await api.delete(`/admin/products/${id}`)
  },

  /* ---------- VARIANTS ---------- */

  createVariant: async (data: CreateVariantBody): Promise<Variant> => {
    const res = await api.post(
      `/admin/products/${data.productId}/variants`,
      data
    )
    return res.data.data
  },

  updateVariant: async (
    id: string,
    data: UpdateVariantBody
  ): Promise<Variant> => {
    const res = await api.put(`/admin/products/variants/${id}`, data)
    return res.data.data
  },

  deleteVariant: async (id: string): Promise<void> => {
    await api.delete(`/admin/products/variants/${id}`)
  },

  searchProducts: async (q: string) => {
    const res = await api.get("/products/search", { params: { q } })
    return res.data.data
  },
}