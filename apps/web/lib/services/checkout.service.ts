import { api } from "../api-client"

const AFFILIATE_KEY = "affiliate_id"

function getAffiliateId(): string | null {
  if (typeof window === "undefined") return null
  try {
    return localStorage.getItem(AFFILIATE_KEY)
  } catch {
    return null
  }
}

function generateIdempotencyKey(): string {
  // Stable per-session per-cart key: userId not available here so use timestamp + random
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export interface CartItemPayload {
  productId: string
  variantId?: string | null
  quantity: number
}

export const CheckoutService = {
  /**
   * Step 1 — Create the order record.
   * Returns { orderId, total, subtotal, discount }
   */
  createOrder: async (
    addressId: string,
    cartItems: CartItemPayload[],
    couponCode?: string | null
  ) => {
    const affiliateId = getAffiliateId()
    const headers: Record<string, string> = {
      "Idempotency-Key": generateIdempotencyKey(),
    }
    if (affiliateId) headers["X-Affiliate-Id"] = affiliateId

    const res = await api.post(
      "/orders",
      {
        addressId,
        cartItems: cartItems.map((i) => ({
          productId: i.productId,
          variantId: i.variantId || undefined,
          quantity: i.quantity,
        })),
        ...(couponCode ? { couponCode } : {}),
      },
      { headers }
    )
    return res.data.data as { orderId: string; total: number; subtotal: number; discount: number }
  },

  /**
   * Step 2a — COD: confirm COD payment for an order.
   */
  confirmCod: async (orderId: string) => {
    const res = await api.post("/payments/cod", { orderId })
    return res.data.data as { orderId: string; status: string }
  },

  /**
   * Step 2b — ONLINE: create Razorpay order for payment.
   * Returns { razorpayOrderId, orderId, amount, currency, keyId }
   */
  createRazorpayOrder: async (orderId: string) => {
    const res = await api.post("/payments/create", { orderId })
    return res.data.data as {
      razorpayOrderId: string
      orderId: string
      amount: number
      currency: string
      keyId: string
    }
  },

  /**
   * Step 3 — Verify Razorpay payment after Razorpay handler fires.
   */
  verifyPayment: async (payload: {
    razorpayOrderId: string
    razorpayPaymentId: string
    razorpaySignature: string
    orderId: string
  }) => {
    const res = await api.post("/payments/verify", payload)
    return res.data.data as { success: boolean; orderId: string }
  },
}
