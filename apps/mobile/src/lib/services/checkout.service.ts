import { api } from "../api/client";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AFFILIATE_KEY = "affiliate_id";

async function getAffiliateId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(AFFILIATE_KEY);
  } catch {
    return null;
  }
}

export interface CartItemPayload {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

export interface ServiceabilityResult {
  serviceable: boolean;
  prepaid: boolean;
  cod: boolean;
  pickup: boolean;
}

export type PaymentPlan = "FULL" | "PARTIAL";

/** Why partial payment is not on offer. Copy comes from @repo/content. */
export interface PartialReason {
  code: string;
  meta?: Record<string, unknown>;
}

/**
 * The partial-payment half of a checkout quote.
 *
 * `depositAmount` and `balanceAmount` are computed server-side and must be rendered
 * verbatim — never derived on the client. The split follows rounding rules the server
 * owns (the balance is whole rupees so a courier can collect it), and a client that
 * recomputed 20% would show a figure that disagrees with what Razorpay is asked for.
 */
export interface PartialPaymentQuote {
  eligible: boolean;
  depositPercent: number;
  depositAmount: number;
  balanceAmount: number;
  reasons: PartialReason[];
}

export interface CheckoutQuote {
  subtotal: number;
  discount: number;
  shippingCharges: number;
  total: number;
  partialPayment: PartialPaymentQuote;
}

export const CheckoutService = {
  /** Check whether Delhivery delivers to a pincode. */
  checkServiceability: async (pincode: string): Promise<ServiceabilityResult> => {
    const res = await api.get("/checkout/serviceability", { params: { pincode } });
    return res.data.data as ServiceabilityResult;
  },

  /** Step 1 — create the order record (idempotency key dedupes retries). */
  createOrder: async (
    addressId: string,
    cartItems: CartItemPayload[],
    couponCode?: string | null,
    idempotencyKey?: string,
    plan?: { paymentPlan: PaymentPlan; acceptForfeitTerms?: boolean }
  ) => {
    const affiliateId = await getAffiliateId();
    const headers: Record<string, string> = {};
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    if (affiliateId) headers["X-Affiliate-Id"] = affiliateId;

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
        // Omitted entirely for a full-payment order so the request stays byte-identical
        // to what shipped before this feature; the server defaults paymentPlan to FULL.
        ...(plan?.paymentPlan === "PARTIAL"
          ? { paymentPlan: "PARTIAL", acceptForfeitTerms: true }
          : {}),
      },
      { headers }
    );
    return res.data.data as {
      orderId: string;
      total: number;
      subtotal: number;
      discount: number;
      paymentPlan: PaymentPlan;
      amountDueNow: number;
      balanceDue: number;
    };
  },

  /** Step 2 — create the Razorpay order to pay against. */
  createRazorpayOrder: async (orderId: string) => {
    const res = await api.post("/payments/create", { orderId });
    return res.data.data as {
      razorpayOrderId: string;
      orderId: string;
      /** The deposit on a partial order, the whole total otherwise. */
      amount: number;
      currency: string;
      keyId: string;
      purpose: "FULL" | "DEPOSIT" | "BALANCE";
      balanceDue: number;
    };
  },

  /**
   * The customer left the payment sheet without paying.
   *
   * Stock is held from order creation onwards, so reporting this puts the units
   * back on sale immediately instead of leaving them locked until the server-side
   * TTL expires. Best-effort — the sweeper is the guarantee, this is the fast path.
   */
  abandonOrder: async (orderId: string) => {
    await api.post(`/orders/${orderId}/abandon`);
  },

  /** Step 3 — verify Razorpay payment. */
  verifyPayment: async (payload: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    orderId: string;
  }) => {
    const res = await api.post("/payments/verify", payload);
    return res.data.data as { success: boolean; orderId: string };
  },

  /** POST /checkout/calculate — server-side totals (tax/shipping/discount). */
  calculate: async (
    cartItems: CartItemPayload[],
    addressId: string,
    couponCode?: string | null
  ): Promise<CheckoutQuote> => {
    const res = await api.post("/checkout/calculate", {
      cartItems,
      addressId,
      ...(couponCode ? { couponCode } : {}),
    });
    return res.data.data as CheckoutQuote;
  },
};
