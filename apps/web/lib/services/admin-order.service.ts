import { api } from "../api-client"

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURN_REQUESTED"
  | "RETURN_APPROVED"
  | "RETURN_REJECTED"
  | "RETURNED"
  | "REFUND_INITIATED"
  | "REFUNDED"

export interface AdminOrder {
  id: string
  status: OrderStatus
  total: number
  createdAt: string

  user: {
    name: string
  }

  payment?: {
    status: string
    amount: number
  }
}

export const AdminOrderService = {
  getOrders: async (params?: any) => {
    const res = await api.get("/admin/orders", { params })
    return res.data.data
  },

  updateStatus: async (id: string, status: OrderStatus) => {
    const res = await api.put(`/admin/orders/${id}/status`, { status })
    return res.data.data
  },

  createShipment: async (id: string) => {
    await api.post(`/admin/orders/${id}/ship`)
  },

  resolveReturn: async (id: string, payload: any) => {
    await api.put(`/admin/returns/${id}/resolve`, payload)
  },
}