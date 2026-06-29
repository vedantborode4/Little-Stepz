import { api } from "../api-client"

export type PreOrderStatus =
  | "PENDING_BOOKING"
  | "BOOKED"
  | "AWAITING_BALANCE"
  | "COMPLETED"
  | "EXPIRED"
  | "CANCELLED"
  | "REFUNDED"

export interface AdminPreOrder {
  id: string
  status: PreOrderStatus
  quantity: number
  unitPrice: number
  bookingAmount: number
  totalAmount: number
  balanceAmount: number
  bookingPaidAt?: string | null
  balancePaidAt?: string | null
  balanceDueAt?: string | null
  notifiedAt?: string | null
  refundedAt?: string | null
  orderId?: string | null
  createdAt: string
  user: { id: string; name: string; email: string }
  product: { id: string; name: string; slug: string }
  variant?: { id: string; name: string } | null
}

export const AdminPreOrderService = {
  list: async (params?: { page?: number; limit?: number; status?: string }) => {
    const res = await api.get("/admin/pre-orders", { params })
    const d = res.data.data
    return {
      preOrders: d.preOrders as AdminPreOrder[],
      total: d.total as number,
      page: d.page as number,
      pages: d.pages as number,
    }
  },

  getById: async (id: string): Promise<AdminPreOrder> => {
    const res = await api.get(`/admin/pre-orders/${id}`)
    return res.data.data
  },

  refundBooking: async (id: string) => {
    const res = await api.post(`/admin/pre-orders/${id}/refund-booking`)
    return res.data.data
  },

  cancel: async (id: string) => {
    const res = await api.post(`/admin/pre-orders/${id}/cancel`)
    return res.data.data
  },

  resendLink: async (id: string) => {
    const res = await api.post(`/admin/pre-orders/${id}/resend-link`)
    return res.data.data
  },
}
