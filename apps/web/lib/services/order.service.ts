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

  /** POST /orders/:id/return — customer initiates a return request */
  requestReturn: async (id: string, reason: string) => {
    const res = await api.post(`/orders/${id}/return`, { reason })
    return res.data.data
  },

  /** POST /orders/:id/cancel — customer cancels a pending/confirmed order */
  cancelOrder: async (id: string, reason?: string) => {
    const res = await api.post(`/orders/${id}/cancel`, { reason })
    return res.data.data
  },
}
