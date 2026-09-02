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
  /** Id of the Return raised against this order, if any — what `resolveReturn` addresses. */
  returnId: string | null
  returnStatus: "PENDING" | "APPROVED" | "REJECTED" | "REFUNDED" | null
  paymentPlan?: "FULL" | "PARTIAL"
  /** Still to collect, in rupees. 0 on a full-payment or settled order. */
  balanceOutstanding?: number
  /** Null on a full-payment order. */
  partial?: AdminOrderPartial | null
}

/** The partial-payment view of an order, as the admin panel needs it. */
export interface AdminOrderPartial {
  depositAmount: number
  balanceAmount: number
  depositPaidAt: string | null
  balancePaidAt: string | null
  balanceStatus: "DUE" | "PAID" | "WRITTEN_OFF"
  balanceMethod: "ONLINE" | "COD" | "MANUAL" | null
  balanceReference: string | null
  /** A COD parcel is committed, so the courier collects the balance at the door. */
  collectedAtDoor: boolean
  depositForfeited: boolean
  depositForfeitedAt: string | null
  /** Owed back to the customer by hand — a cash balance no gateway can reverse. */
  manualRefundAmount: number | null
  manualRefundSettledAt: string | null
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
  /**
   * Download the tax invoice PDF.
   *
   * Fetched through the axios client rather than linked directly so the request
   * carries the auth header (and the 401-refresh interceptor); the response is a
   * blob, saved via a temporary object URL.
   */
  downloadInvoice: async (orderId: string) => {
    const res = await api.get(`/admin/orders/${orderId}/invoice`, { responseType: "blob" })
    const disposition = res.headers?.["content-disposition"] as string | undefined
    const match = disposition?.match(/filename="?([^"]+)"?/)
    const filename = match?.[1] ?? `invoice-${orderId.slice(0, 8)}.pdf`

    const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }))
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Revoked on the next tick so the click has already started the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  },

  getById: async (id: string): Promise<AdminOrderDetail> => {
    const res = await api.get(`/admin/orders/${id}`)
    return res.data.data
  },

  /** PUT /admin/orders/:id/status — body: { status } */
  updateStatus: async (id: string, status: OrderStatus) => {
    const res = await api.put(`/admin/orders/${id}/status`, { status })
    return res.data.data
  },

  /**
   * POST /admin/orders/:id/balance/mark-paid — record a balance collected outside the
   * gateway. Books the payment, and (once delivered) the invoice and commission with it.
   */
  markBalancePaid: async (
    id: string,
    body: { method: "CASH" | "BANK_TRANSFER" | "UPI" | "OTHER"; reference?: string; note?: string }
  ) => {
    const res = await api.post(`/admin/orders/${id}/balance/mark-paid`, body)
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

  /**
   * PUT /admin/returns/:id/resolve
   *
   * `returnId` is the Return's id, NOT the order's — the route resolves a Return.
   * The body shape is dictated by `resolveReturnBodySchema`, which is `.strict()`:
   * this used to send `{ action, reason }`, which every call rejected with a 400.
   */
  resolveReturn: async (
    returnId: string,
    body: { status: "APPROVED" | "REJECTED"; adminNote?: string; refundAmount?: number }
  ) => {
    const res = await api.put(`/admin/returns/${returnId}/resolve`, body)
    return res.data.data
  },
}
