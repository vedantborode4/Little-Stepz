import { api } from "../api-client"

export type OrderStatus =
  | "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED"
  | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED"
  | "RETURN_REQUESTED" | "RETURN_APPROVED" | "RETURN_REJECTED"
  | "RETURNED" | "REFUND_INITIATED" | "REFUNDED"

export interface AdminOrder {
  id: string
  status: OrderStatus
  subtotal: number
  discount: number
  shippingCharges: number
  total: number
  paymentMethod: string
  shippingAddress: Record<string, any>
  createdAt: string
  updatedAt: string
  user: { id: string; name: string }
  payment: { status: string; amount: number } | null
}

export interface AdminOrderItem {
  id: string
  quantity: number
  price: number
  subtotal: number
  /** Snapshot taken at order time — never the live product name. */
  productName: string
  variantName: string | null
  image: string | null
  productSlug: string
}

export interface AdminOrderAddress {
  id: string
  name: string
  phone: string
  address: string
  city: string
  state: string
  pincode: string
  country: string
}

export interface AdminOrderDetail extends Omit<AdminOrder, "shippingAddress" | "user" | "payment"> {
  user: { id: string; name: string; email: string; phone: string | null }
  address: AdminOrderAddress | null
  items: AdminOrderItem[]
  coupon: { code: string; type: string; value: number } | null
  payment: {
    id: string
    method: string
    gateway: string
    status: string
    amount: number
    currency: string
    razorpayOrderId: string | null
    razorpayPaymentId: string | null
    refundId: string | null
    refundAmount: number | null
    refundedAt: string | null
    refundReason: string | null
    codCollectedAt: string | null
    attempts: number
  } | null
  shipments: {
    id: string
    awbCode: string | null
    courierName: string | null
    trackingUrl: string | null
    status: string
    estimatedAt: string | null
    deliveredAt: string | null
    createdAt: string
  }[]
}

export interface AdminOrdersResponse {
  orders: AdminOrder[]
  total: number
  page: number
  limit: number
  pages: number
}

export const AdminOrderService = {
  /** GET /admin/orders */
  getOrders: async (params?: {
    page?: number
    limit?: number
    status?: OrderStatus
    fromDate?: string
    toDate?: string
  }): Promise<AdminOrdersResponse> => {
    const res = await api.get("/admin/orders", { params })
    return res.data.data
  },

  /** GET /admin/orders/:id — full order: items, address, payment, shipments. */
  getById: async (id: string): Promise<AdminOrderDetail> => {
    const res = await api.get(`/admin/orders/${id}`)
    return res.data.data
  },

  /** PUT /admin/orders/:id/status — body: { status } */
  updateStatus: async (id: string, status: OrderStatus) => {
    const res = await api.put(`/admin/orders/${id}/status`, { status })
    return res.data.data
  },

  /** POST /admin/orders/:id/ship */
  createShipment: async (id: string) => {
    const res = await api.post(`/admin/orders/${id}/ship`)
    return res.data.data
  },

  /** POST /admin/orders/:id/cancel-shipment */
  cancelShipment: async (id: string) => {
    const res = await api.post(`/admin/orders/${id}/cancel-shipment`)
    return res.data.data
  },

  /** PUT /admin/returns/:id/resolve */
  resolveReturn: async (id: string, body: { action: "APPROVE" | "REJECT"; reason?: string }) => {
    const res = await api.put(`/admin/returns/${id}/resolve`, body)
    return res.data.data
  },
}
