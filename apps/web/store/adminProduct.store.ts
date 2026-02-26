import { create } from "zustand"
import { AdminProductService } from "../lib/services/admin-product.service"

interface State {
  products: any[]
  pagination: any
  loading: boolean

  fetchProducts: (query?: any) => Promise<void>
  deleteProduct: (id: string) => Promise<void>
}

export const useAdminProductStore = create<State>((set) => ({
  products: [],
  pagination: null,
  loading: false,

  fetchProducts: async (query) => {
    set({ loading: true })

    const res = await AdminProductService.getProducts(query)

    set({
      products: res.products,
      pagination: res,
      loading: false,
    })
  },

  deleteProduct: async (id) => {
    await AdminProductService.deleteProduct(id)

    set((state) => ({
      products: state.products.filter((p) => p.id !== id),
    }))
  },
}))