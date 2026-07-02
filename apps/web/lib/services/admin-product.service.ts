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
  sku?: string | null
  sortOrder?: number
  isDefault?: boolean
  price: number | null
  salePrice?: number | null
  isOnSale?: boolean
  stock: number
  images?: ProductImage[]
  optionValues?: { optionValueId: string }[]
}

export interface ProductOptionValue {
  id: string
  value: string
  swatchHex?: string | null
  sortOrder?: number
}

export interface ProductOption {
  id: string
  name: string
  sortOrder?: number
  values: ProductOptionValue[]
}

export interface MatrixBody {
  options: { name: string; values: { value: string; swatchHex?: string | null }[] }[]
  defaults?: { price?: number; salePrice?: number; isOnSale?: boolean; stock?: number }
}

export interface VariantBody {
  name: string
  sku?: string | null
  sortOrder?: number
  isDefault?: boolean
  price?: number | null
  salePrice?: number | null
  isOnSale?: boolean
  stock?: number
}

export type PriceDisplay = "BOTH" | "REGULAR" | "SALE"

export interface AdminProduct {
  id: string
  name: string
  slug: string
  description?: string
  longDescription?: string | null
  price: number
  salePrice?: number | null
  isOnSale?: boolean
  priceDisplay?: PriceDisplay
  quantity: number
  inStock: boolean
  preOrderEnabled?: boolean
  bookingAmount?: number | null
  preOrderLimit?: number | null
  preOrderCount?: number
  preOrderNote?: string | null
  categoryId?: string
  category?: { id: string; name: string; slug: string }
  images: ProductImage[]
  variants: ProductVariant[]
  options?: ProductOption[]
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

  /**
   * GET /admin/products/:id — fetch a single product by UUID.
   * Falls back to searching the product list if a dedicated endpoint is not available.
   */
  getProductById: async (id: string): Promise<AdminProduct> => {
    try {
      const res = await api.get(`/admin/products/${id}`)
      return res.data.data
    } catch {
      // Fallback: scan the products list to find by ID
      const res = await api.get("/products", { params: { limit: 200 } })
      const products: AdminProduct[] = res.data.data?.products ?? []
      const found = products.find((p) => p.id === id)
      if (!found) throw new Error(`Product ${id} not found`)
      return found
    }
  },

  /** POST /admin/products  body: CreateProductBody */
  createProduct: async (body: {
    name: string; slug: string; description?: string; longDescription?: string
    price: number; salePrice?: number; isOnSale?: boolean; priceDisplay?: PriceDisplay
    quantity?: number; inStock?: boolean; categoryId: string
    preOrderEnabled?: boolean; bookingAmount?: number; preOrderLimit?: number; preOrderNote?: string
  }): Promise<AdminProduct> => {
    const res = await api.post("/admin/products", body)
    return res.data.data
  },

  /** PUT /admin/products/:id  body: UpdateProductBody */
  updateProduct: async (id: string, body: Partial<{
    name: string; slug: string; description: string | null; longDescription: string | null
    price: number; salePrice: number | null; isOnSale: boolean; priceDisplay: PriceDisplay
    quantity: number; inStock: boolean; categoryId: string
    preOrderEnabled: boolean; bookingAmount: number; preOrderLimit: number; preOrderNote: string
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

  /** POST /admin/products/:productId/variants */
  createVariant: async (productId: string, body: VariantBody): Promise<ProductVariant> => {
    const res = await api.post(`/admin/products/${productId}/variants`, body)
    return res.data.data
  },

  /** PUT /admin/products/variants/:id */
  updateVariant: async (id: string, body: Partial<VariantBody>): Promise<ProductVariant> => {
    const res = await api.put(`/admin/products/variants/${id}`, body)
    return res.data.data
  },

  /** DELETE /admin/products/variants/:id */
  deleteVariant: async (id: string) => {
    await api.delete(`/admin/products/variants/${id}`)
  },

  // ── Options / variant matrix ──────────────────────────────────────────────

  /** POST /admin/products/:productId/variants/matrix */
  generateVariantMatrix: async (productId: string, body: MatrixBody): Promise<{ created: number; skipped: number; total: number }> => {
    const res = await api.post(`/admin/products/${productId}/variants/matrix`, body)
    return res.data.data
  },

  /** DELETE /admin/products/options/:optionId */
  deleteOption: async (optionId: string) => {
    await api.delete(`/admin/products/options/${optionId}`)
  },
}
