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

export interface CartItemPayload {
  productId: string
  variantId?: string | null
  quantity: number
}

export interface ServiceabilityResult {
  serviceable: boolean
  prepaid: boolean
  cod: boolean
  pickup: boolean
}

export const CheckoutService = {
  /**
   * Check whether Delhivery delivers to a pincode (+ COD/prepaid availability).
   * GET /checkout/serviceability?pincode=
   */
  checkServiceability: async (pincode: string): Promise<ServiceabilityResult> => {
    const res = await api.get("/checkout/serviceability", { params: { pincode } })
    return res.data.data as ServiceabilityResult
  },

  /**
   * Step 1 — Create the order record.
   * idempotencyKey is generated ONCE per checkout session by the store
   * and reused on retries so the backend deduplicates repeated calls.
   */
  createOrder: async (
    addressId: string,
    cartItems: CartItemPayload[],
    couponCode?: string | null,
    idempotencyKey?: string
  ) => {
    const affiliateId = getAffiliateId()
    const headers: Record<string, string> = {}

    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey
    if (affiliateId)    headers["X-Affiliate-Id"]  = affiliateId

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