import { api } from "../api-client"

export interface ProductImage {
  id: string
  url: string
  alt?: string
  sortOrder: number
}

export interface ProductVariant {
  id: string
  name: string
  price: number | null
  stock: number
}

export interface AdminProduct {
  id: string
  name: string
  slug: string
  description?: string
  price: number
  quantity: number
  inStock: boolean
  categoryId?: string
  category?: { id: string; name: string; slug: string }
  images: ProductImage[]
  variants: ProductVariant[]
  createdAt: string
  updatedAt: string
}

export const AdminProductService = {
  /** GET /products?page=&limit=&sort= */
  getProducts: async (params?: { page?: number; limit?: number; sort?: string; inStock?: boolean }) => {
    const res = await api.get("/products", { params })
    const d = res.data.data
    return {
      products: d.products as AdminProduct[],
      total: d.total as number,
      page: d.page as number,
      pages: d.pages as number,
    }
  },

  /** GET /products/search?q= */
  searchProducts: async (q: string) => {
    const res = await api.get("/products/search", { params: { q } })
    const d = res.data.data
    return { products: (d.products ?? d) as AdminProduct[] }
  },

  /** GET /products/:slug */
  getBySlug: async (slug: string): Promise<AdminProduct> => {
    const res = await api.get(`/products/${slug}`)
    return res.data.data
  },

  /** POST /admin/products  body: CreateProductBody */
  createProduct: async (body: {
    name: string; slug: string; description?: string
    price: number; quantity?: number; inStock?: boolean; categoryId: string
  }): Promise<AdminProduct> => {
    const res = await api.post("/admin/products", body)
    return res.data.data
  },

  /** PUT /admin/products/:id  body: UpdateProductBody */
  updateProduct: async (id: string, body: Partial<{
    name: string; slug: string; description: string | null
    price: number; quantity: number; inStock: boolean; categoryId: string
  }>): Promise<AdminProduct> => {
    const res = await api.put(`/admin/products/${id}`, body)
    return res.data.data
  },

  /** DELETE /admin/products/:id */
  deleteProduct: async (id: string) => {
    await api.delete(`/admin/products/${id}`)
  },

  // ── Images ──────────────────────────────────────────────────────────────

  /** POST /admin/products/:productId/images  body: { url, alt?, sortOrder? } */
  addImage: async (productId: string, body: { url: string; alt?: string; sortOrder?: number }): Promise<ProductImage> => {
    const res = await api.post(`/admin/products/${productId}/images`, body)
    return res.data.data
  },

  /** PUT /admin/products/images/:imageId/reorder  body: { sortOrder } */
  reorderImage: async (imageId: string, sortOrder: number): Promise<ProductImage> => {
    const res = await api.put(`/admin/products/images/${imageId}/reorder`, { sortOrder })
    return res.data.data
  },

  /** DELETE /admin/products/images/:imageId */
  deleteImage: async (imageId: string) => {
    await api.delete(`/admin/products/images/${imageId}`)
  },

  // ── Variants ────────────────────────────────────────────────────────────

  /** POST /admin/products/:productId/variants  body: { name, price?, stock? } */
  createVariant: async (productId: string, body: { name: string; price?: number | null; stock?: number }): Promise<ProductVariant> => {
    const res = await api.post(`/admin/products/${productId}/variants`, body)
    return res.data.data
  },

  /** PUT /admin/products/variants/:id  body: { name?, price?, stock? } */
  updateVariant: async (id: string, body: { name?: string; price?: number | null; stock?: number }): Promise<ProductVariant> => {
    const res = await api.put(`/admin/products/variants/${id}`, body)
    return res.data.data
  },

  /** DELETE /admin/products/variants/:id */
  deleteVariant: async (id: string) => {
    await api.delete(`/admin/products/variants/${id}`)
  },
}
