import { create } from "zustand";
import { CheckoutService, type PaymentPlan } from "../lib/services/checkout.service";
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

/**
 * A real second variant rather than a flag on `online`, so the balance figure is
 * type-checked all the way to the verifying screen. As an optional field it would
 * eventually be dropped by a caller and the confirmation would quietly stop telling the
 * customer what they still owe.
 */
export type PlaceOrderResult =
  | { kind: "online"; orderId: string; rzp: RazorpayInit }
  | { kind: "partial"; orderId: string; rzp: RazorpayInit; depositAmount: number; balanceAmount: number }
  | null;

interface CheckoutState {
  placingOrder: boolean;
  /** Address → Review → Payment. Held here so returning from the Razorpay screen
   *  doesn't drop the user back at step 1. */
  step: number;
  /** Which plan the customer picked. Lives here for the same reason `step` does. */
  paymentPlan: PaymentPlan;
  /** Whether they ticked the deposit-forfeiture acknowledgement. */
  forfeitureAck: boolean;
  _idempotencyKey: string | null;
  _keySignature: string | null;

  setStep: (step: number) => void;
  setPaymentPlan: (plan: PaymentPlan) => void;
  setForfeitureAck: (ack: boolean) => void;
  placeOrder: (addressId: string) => Promise<PlaceOrderResult>;
  abandonOrder: (orderId: string) => void;
  resetSession: () => void;
}

const generateKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const useCheckoutStore = create<CheckoutState>((set, get) => ({
  placingOrder: false,
  step: 0,
  paymentPlan: "FULL",
  forfeitureAck: false,
  _idempotencyKey: null,
  _keySignature: null,

  setStep: (step) => set({ step }),
  // Changing the plan invalidates the acknowledgement: it is specific to a deposit
  // amount the customer was shown, so it must be re-given if that changes.
  setPaymentPlan: (plan) => set({ paymentPlan: plan, forfeitureAck: false }),
  setForfeitureAck: (ack) => set({ forfeitureAck: ack }),
  resetSession: () =>
    set({
      _idempotencyKey: null,
      _keySignature: null,
      placingOrder: false,
      step: 0,
      paymentPlan: "FULL",
      forfeitureAck: false,
    }),

  /**
   * The customer left the payment sheet without paying.
   *
   * Releases the stock the order is holding — it was decremented at order creation,
   * so until this lands nobody else can buy those units — and retires the
   * idempotency key that points at it, since that order is now cancelled and
   * replaying it would only earn an ORDER_NOT_PENDING.
   *
   * Fire-and-forget: the server-side sweeper reclaims the order regardless, so a
   * failed call costs a few minutes of held stock, never correctness.
   */
  abandonOrder: (orderId) => {
    void CheckoutService.abandonOrder(orderId).catch(() => {});
    set({ _idempotencyKey: null, _keySignature: null });
  },

  placeOrder: async (addressId) => {
    if (get().placingOrder) return null;

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

    const { paymentPlan, forfeitureAck } = get();

    // The deposit terms are the contractual basis for keeping the money, so the
    // acknowledgement is checked here as well as server-side — reaching Razorpay and
    // being rejected after the sheet opens would be a worse experience than not opening it.
    if (paymentPlan === "PARTIAL" && !forfeitureAck) {
      toast.error("Please confirm you understand the deposit is non-refundable.");
      return null;
    }

    // The key is stable for a given cart+address+coupon+plan, so a retry after a failed
    // payment dedupes onto the same order. Editing the cart changes the signature and
    // starts a genuinely new order — the abandoned one is reaped server-side.
    //
    // `paymentPlan` is part of the signature deliberately. Without it, switching from
    // partial to full after an abandoned attempt would replay the old deposit order and
    // charge the customer 20% when they asked to pay in full — or the reverse.
    const signature = JSON.stringify({
      addressId,
      couponCode: couponCode || null,
      cartItems,
      paymentPlan,
    });
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
        idempotencyKey,
        { paymentPlan, acceptForfeitTerms: forfeitureAck }
      );

      // Create the Razorpay order; the WebView screen handles payment + verify.
      // `rzp.amount` is the deposit on a partial order — the server decides it, and the
      // sheet is opened for exactly what the server said.
      const rzp = await CheckoutService.createRazorpayOrder(orderId);
      set({ placingOrder: false });

      if (paymentPlan === "PARTIAL") {
        return {
          kind: "partial",
          orderId,
          rzp,
          depositAmount: rzp.amount,
          balanceAmount: rzp.balanceDue,
        };
      }
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

      // Eligibility lapsed between the quote and the order — the pincode changed, a cap
      // was hit, another order's balance came due. Fall back to full payment and stop:
      // silently charging the full amount because pay-later disappeared is the worst
      // possible outcome, so the customer has to re-confirm.
      const code = err?.response?.data?.message;
      if (
        code === "PARTIAL_PAYMENT_NOT_ELIGIBLE" ||
        code === "PARTIAL_NOT_ELIGIBLE" ||
        code === "PARTIAL_ORDER_VALUE_EXCEEDED" ||
        code === "PARTIAL_LIMIT_REACHED" ||
        code === "PARTIAL_PAYMENT_DISABLED" ||
        code === "PARTIAL_AMOUNT_TOO_SMALL"
      ) {
        set({
          placingOrder: false,
          paymentPlan: "FULL",
          forfeitureAck: false,
          _idempotencyKey: null,
          _keySignature: null,
        });
        toast.error(getErrorMessage(err, "Pay-later is no longer available for this order."));
        return null;
      }
      toast.error(getErrorMessage(err, "Something went wrong. Please try again."));
      set({ placingOrder: false });
      return null;
    }
  },
}));
