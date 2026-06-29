import { api } from "../api-client"

export type PreOrderStatus =
  | "PENDING_BOOKING"
  | "BOOKED"
  | "AWAITING_BALANCE"
  | "COMPLETED"
  | "EXPIRED"
  | "CANCELLED"
  | "REFUNDED"

export interface PreOrderSummary {
  id: string
  status: PreOrderStatus
  quantity: number
  unitPrice: number
  bookingAmount: number
  shippingCharges: number
  totalAmount: number
  balanceAmount: number
  balanceDueAt?: string | null
  bookingPaidAt?: string | null
  balancePaidAt?: string | null
  orderId?: string | null
  balanceToken?: string | null
  createdAt: string
  product: { id: string; name: string; slug: string; images: { url: string }[] }
  variant?: { id: string; name: string } | null
}

interface RazorpayInit {
  razorpayOrderId: string
  amount: number
  currency: string
  keyId: string
}

interface VerifyBody {
  razorpayOrderId: string
  razorpayPaymentId: string
  razorpaySignature: string
}

export const PreOrderService = {
  /**
   * Create a pre-order + booking Razorpay order. Pass a STABLE idempotencyKey
   * (one per checkout attempt) so retries/double-clicks de-duplicate server-side.
   */
  create: async (
    body: { productId: string; variantId?: string; quantity: number; addressId: string },
    idempotencyKey: string
  ) => {
    const res = await api.post("/pre-orders", body, { headers: { "Idempotency-Key": idempotencyKey } })
    return res.data.data as RazorpayInit & { preOrderId: string }
  },

  verifyBooking: async (preOrderId: string, body: VerifyBody) => {
    const res = await api.post(`/pre-orders/${preOrderId}/booking/verify`, body)
    return res.data.data
  },

  getMine: async (): Promise<PreOrderSummary[]> => {
    const res = await api.get("/pre-orders")
    return res.data.data.preOrders
  },

  getById: async (id: string): Promise<PreOrderSummary> => {
    const res = await api.get(`/pre-orders/${id}`)
    return res.data.data
  },

  // ── Balance (token-gated, public) ──
  getByToken: async (token: string): Promise<PreOrderSummary> => {
    const res = await api.get(`/pre-orders/pay/${token}`)
    return res.data.data
  },

  createBalancePayment: async (token: string) => {
    const res = await api.post(`/pre-orders/pay/${token}/create-payment`)
    return res.data.data as RazorpayInit
  },

  verifyBalance: async (token: string, body: VerifyBody) => {
    const res = await api.post(`/pre-orders/pay/${token}/verify`, body)
    return res.data.data
  },
}
