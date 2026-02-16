import { create } from "zustand"
import { OrderService } from "../lib/services/order.service"

interface OrderState {
  orders: any[]
  currentOrder: any | null
  loading: boolean

  fetchOrders: () => Promise<void>
  fetchOrderById: (id: string) => Promise<void>
}

export const useOrderStore = create<OrderState>((set) => ({
  orders: [],
  currentOrder: null,
  loading: false,

  fetchOrders: async () => {
    set({ loading: true })
    const data = await OrderService.getAll()
    set({ orders: data, loading: false })
  },

  fetchOrderById: async (id) => {
    set({ loading: true })
    const data = await OrderService.getById(id)
    set({ currentOrder: data, loading: false })
  },
}))
