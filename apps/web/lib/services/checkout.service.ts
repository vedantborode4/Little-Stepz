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
   * Check whether Delhivery delivers to a pincode.
   * GET /checkout/serviceability?pincode=
   */
  checkServiceability: async (pincode: string): Promise<ServiceabilityResult> => {
    const res = await api.get("/checkout/serviceability", { params: { pincode } })
    return res.data.data as ServiceabilityResult
  },

  /**
   * Server-side totals (shipping, discount, tax). The checkout summary renders
   * these rather than computing its own, so what the customer sees is what the
   * backend will charge.
   */
  calculate: async (
    cartItems: CartItemPayload[],
    addressId: string,
    couponCode?: string | null
  ) => {
    const res = await api.post("/checkout/calculate", {
      cartItems: cartItems.map((i) => ({
        productId: i.productId,
        variantId: i.variantId || undefined,
        quantity: i.quantity,
      })),
      addressId,
      ...(couponCode ? { couponCode } : {}),
    })
    return res.data.data as {
      subtotal: number
      discount: number
      shippingCharges: number
      total: number
    }
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
   * Step 2 — create the Razorpay order to pay against.
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
   * The customer closed the payment sheet without paying.
   *
   * Stock is held from the moment the order is created, so telling the backend
   * immediately puts those units back on sale in milliseconds instead of leaving
   * them locked until the server-side TTL expires. Best-effort by design — the
   * sweeper is the guarantee, this is just the fast path.
   */
  abandonOrder: async (orderId: string) => {
    await api.post(`/orders/${orderId}/abandon`)
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