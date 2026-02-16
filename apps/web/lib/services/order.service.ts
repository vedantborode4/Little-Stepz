import { api } from "../api-client"

export const OrderService = {
  getAll: async () => {
    const res = await api.get("/orders")
    return res.data.data
  },

  getById: async (id: string) => {
    const res = await api.get(`/orders/${id}`)
    return res.data.data
  },
}
