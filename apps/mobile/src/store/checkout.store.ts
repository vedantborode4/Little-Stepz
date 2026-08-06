import { create } from "zustand";
import { CheckoutService } from "../lib/services/checkout.service";
import { getErrorMessage } from "../lib/utils/errors";
import { useCartStore } from "./cart.store";
import { toast } from "./toast.store";

export interface RazorpayInit {
  razorpayOrderId: string;
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export type PlaceOrderResult =
  | { kind: "cod"; orderId: string }
  | { kind: "online"; orderId: string; rzp: RazorpayInit }
  | null;

interface CheckoutState {
  placingOrder: boolean;
  paymentMethod: "COD" | "ONLINE";
  _idempotencyKey: string | null;
  _keySignature: string | null;

  setPaymentMethod: (m: "COD" | "ONLINE") => void;
  placeOrder: (addressId: string) => Promise<PlaceOrderResult>;
  resetSession: () => void;
}

const generateKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const useCheckoutStore = create<CheckoutState>((set, get) => ({
  placingOrder: false,
  paymentMethod: "COD",
  _idempotencyKey: null,
  _keySignature: null,

  setPaymentMethod: (m) => set({ paymentMethod: m }),
  resetSession: () => set({ _idempotencyKey: null, _keySignature: null, placingOrder: false }),

  placeOrder: async (addressId) => {
    if (get().placingOrder) return null;

    const { paymentMethod } = get();
    const { items, couponCode } = useCartStore.getState();

    if (!addressId) {
      toast.error("Please select a delivery address");
      return null;
    }
    if (!items.length) {
      toast.error("Your cart is empty");
      return null;
    }

    const cartItems = items.map((i) => ({
      productId: i.productId,
      variantId: i.variantId ?? undefined,
      quantity: i.quantity,
    }));

    // The key is stable for a given cart+address+coupon, so a retry after a failed
    // payment dedupes onto the same order. Editing the cart changes the signature and
    // starts a genuinely new order — the abandoned one is reaped server-side.
    const signature = JSON.stringify({ addressId, couponCode: couponCode || null, cartItems });
    let idempotencyKey = get()._idempotencyKey;
    if (!idempotencyKey || get()._keySignature !== signature) {
      idempotencyKey = generateKey();
      set({ _idempotencyKey: idempotencyKey, _keySignature: signature });
    }

    set({ placingOrder: true });

    try {
      const { orderId } = await CheckoutService.createOrder(
        addressId,
        cartItems,
        couponCode || null,
        idempotencyKey
      );

      if (paymentMethod === "COD") {
        await CheckoutService.confirmCod(orderId);
        set({ placingOrder: false, _idempotencyKey: null, _keySignature: null });
        return { kind: "cod", orderId };
      }

      // ONLINE: create Razorpay order; the WebView screen handles payment + verify.
      const rzp = await CheckoutService.createRazorpayOrder(orderId);
      set({ placingOrder: false });
      return { kind: "online", orderId, rzp };
    } catch (err: any) {
      // The order this key points at is no longer payable — it was reclaimed after
      // being abandoned (see reclaimStalePendingOrders). Drop the spent key so the
      // next attempt starts a fresh order instead of replaying a cancelled one.
      if (err?.response?.data?.message === "ORDER_NOT_PENDING") {
        set({ placingOrder: false, _idempotencyKey: null, _keySignature: null });
        toast.error("That checkout expired. Please try again.");
        return null;
      }
      toast.error(getErrorMessage(err, "Something went wrong. Please try again."));
      set({ placingOrder: false });
      return null;
    }
  },
}));
