import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CartService } from "../lib/services/cart.service";
import { CouponService } from "../lib/services/coupon.service";
import { getChargedPrice } from "../lib/pricing";
import { toast } from "./toast.store";
import type { CartItem } from "../types/cart";

interface AddItemPayload {
  productId: string;
  variantId?: string;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  subtotal: number;
  total: number;
  couponCode: string | null;
  discount: number;
  isValidatingCoupon: boolean;
  isLoading: boolean;
  /** Set when the last load failed, so the UI can say so instead of showing "empty". */
  loadError: boolean;
  /** True once a cart response has been received this session. */
  hasLoaded: boolean;
  updatingKey: string | null;

  fetchCart: () => Promise<void>;
  addItem: (payload: AddItemPayload) => Promise<boolean>;
  updateQuantity: (productId: string, variantId: string | undefined, quantity: number) => Promise<void>;
  removeItem: (productId: string, variantId?: string) => Promise<void>;
  clearCart: () => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => void;
  revalidateCoupon: () => Promise<void>;
  itemCount: () => number;
}

const calcSubtotal = (items: CartItem[]) => items.reduce((acc, i) => acc + i.subtotal, 0);

const matchItem = (item: CartItem, productId: string, variantId?: string) =>
  item.productId === productId && (item.variantId ?? undefined) === variantId;

const getKey = (productId: string, variantId?: string) =>
  `${productId}-${variantId ?? "no-variant"}`;

const tempId = () => `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Cart mutations are serialized. Tapping "+" four times quickly used to fire four
 * overlapping requests whose responses could land out of order, leaving the cart
 * showing a quantity the server no longer held. Each mutation now waits for the
 * previous one, so the last response is always the newest state.
 */
let mutationChain: Promise<unknown> = Promise.resolve();
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = mutationChain.then(task, task);
  // Keep the chain alive regardless of individual failures.
  mutationChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/** Single-flight guard for fetchCart — several screens fetch on focus at once. */
let inFlightFetch: Promise<void> | null = null;

/**
 * Monotonic token for coupon revalidation. A slow response from an older subtotal
 * must never overwrite the discount computed from a newer one.
 */
let couponRun = 0;

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      subtotal: 0,
      total: 0,
      couponCode: null,
      discount: 0,
      isValidatingCoupon: false,
      isLoading: false,
      loadError: false,
      hasLoaded: false,
      updatingKey: null,

      fetchCart: async () => {
        if (inFlightFetch) return inFlightFetch;

        const run = (async () => {
          set({ isLoading: true });
          try {
            const data = await CartService.getCart();
            const { discount } = get();
            set({
              items: data.items,
              subtotal: data.subtotal,
              total: data.subtotal - discount,
              loadError: false,
              hasLoaded: true,
            });
            // A coupon restored from storage carries no discount until revalidated
            // against the current subtotal.
            if (get().couponCode) void get().revalidateCoupon();
          } catch {
            // Never leave the screen to infer "empty cart" from a failed request.
            set({ loadError: true });
          } finally {
            set({ isLoading: false });
            inFlightFetch = null;
          }
        })();

        inFlightFetch = run;
        return run;
      },

      applyCoupon: async (code) => {
        if (!code.trim()) throw new Error("Enter coupon code");
        set({ isValidatingCoupon: true });
        const run = ++couponRun;
        try {
          const subtotal = get().subtotal;
          const res = await CouponService.validate(code, subtotal);
          if (!res?.valid) throw new Error(res?.message || "Invalid coupon");
          if (run !== couponRun) return;
          set({ couponCode: code, discount: res.discount, total: subtotal - res.discount });
        } finally {
          if (run === couponRun) set({ isValidatingCoupon: false });
        }
      },

      removeCoupon: () => {
        couponRun++; // cancel any in-flight revalidation
        const subtotal = get().subtotal;
        set({ couponCode: null, discount: 0, total: subtotal });
      },

      revalidateCoupon: async () => {
        const { couponCode } = get();
        if (!couponCode) return;
        const run = ++couponRun;
        // Read the subtotal at send time and re-read at apply time, so the discount
        // is always paired with the subtotal it was computed against.
        const subtotal = get().subtotal;
        try {
          const res = await CouponService.validate(couponCode, subtotal);
          if (run !== couponRun) return;
          set({ discount: res.discount, total: get().subtotal - res.discount });
        } catch {
          if (run !== couponRun) return;
          toast.error("Coupon removed — cart updated");
          set({ couponCode: null, discount: 0, total: get().subtotal });
        }
      },

      addItem: async (payload) =>
        serialize(async () => {
          const prev = get().items;
          const existing = prev.find((i) => matchItem(i, payload.productId, payload.variantId));

          let optimistic: CartItem[];
          if (existing) {
            optimistic = prev.map((i) =>
              matchItem(i, payload.productId, payload.variantId)
                ? {
                    ...i,
                    quantity: i.quantity + payload.quantity,
                    subtotal: (i.quantity + payload.quantity) * getChargedPrice(i.product, i.variant),
                  }
                : i
            );
          } else {
            optimistic = [
              ...prev,
              {
                id: tempId(),
                productId: payload.productId,
                variantId: payload.variantId ?? null,
                quantity: payload.quantity,
                product: { id: payload.productId, name: "Updating...", slug: "", price: "0", images: [] },
                variant: null,
                subtotal: 0,
              },
            ];
          }

          const newSubtotal = calcSubtotal(optimistic);
          set({ items: optimistic, subtotal: newSubtotal, total: newSubtotal - get().discount });

          try {
            const data = await CartService.add(payload);
            set({
              items: data.items,
              subtotal: data.subtotal,
              total: data.subtotal - get().discount,
              loadError: false,
              hasLoaded: true,
            });
            void get().revalidateCoupon();
            toast.success("Added to cart");
            return true;
          } catch (err: any) {
            const prevSubtotal = calcSubtotal(prev);
            set({ items: prev, subtotal: prevSubtotal, total: prevSubtotal - get().discount });
            // Surface the server's reason (e.g. "Only 2 left in stock") rather than
            // a blanket failure the user can do nothing about.
            toast.error(err?.response?.data?.message || "Failed to add to cart");
            return false;
          }
        }),

      updateQuantity: async (productId, variantId, quantity) => {
        if (quantity < 1) return;
        const key = getKey(productId, variantId);
        set({ updatingKey: key });

        return serialize(async () => {
          const prev = get().items;
          const optimistic = prev.map((i) =>
            matchItem(i, productId, variantId)
              ? { ...i, quantity, subtotal: quantity * getChargedPrice(i.product, i.variant) }
              : i
          );
          const newSubtotal = calcSubtotal(optimistic);
          set({ items: optimistic, subtotal: newSubtotal, total: newSubtotal - get().discount });

          try {
            const data = await CartService.update({ productId, variantId, quantity });
            set({
              items: data.items,
              subtotal: data.subtotal,
              total: data.subtotal - get().discount,
              loadError: false,
            });
            void get().revalidateCoupon();
          } catch (err: any) {
            const prevSubtotal = calcSubtotal(prev);
            set({ items: prev, subtotal: prevSubtotal, total: prevSubtotal - get().discount });
            toast.error(err?.response?.data?.message || "Update failed");
          } finally {
            // Only the newest pending change owns the spinner.
            if (get().updatingKey === key) set({ updatingKey: null });
          }
        });
      },

      removeItem: async (productId, variantId) => {
        const key = getKey(productId, variantId);
        set({ updatingKey: key });

        return serialize(async () => {
          const prev = get().items;
          const optimistic = prev.filter((i) => !matchItem(i, productId, variantId));
          const newSubtotal = calcSubtotal(optimistic);
          set({ items: optimistic, subtotal: newSubtotal, total: newSubtotal - get().discount });

          try {
            const data = await CartService.remove({ productId, variantId });
            set({
              items: data.items,
              subtotal: data.subtotal,
              total: data.subtotal - get().discount,
              loadError: false,
            });
            void get().revalidateCoupon();
          } catch (err: any) {
            const prevSubtotal = calcSubtotal(prev);
            set({ items: prev, subtotal: prevSubtotal, total: prevSubtotal - get().discount });
            toast.error(err?.response?.data?.message || "Remove failed");
          } finally {
            if (get().updatingKey === key) set({ updatingKey: null });
          }
        });
      },

      clearCart: async () =>
        serialize(async () => {
          const prev = get().items;
          couponRun++;
          set({ items: [], subtotal: 0, total: 0, discount: 0, couponCode: null });
          try {
            await CartService.clear();
          } catch {
            const prevSubtotal = calcSubtotal(prev);
            set({ items: prev, subtotal: prevSubtotal, total: prevSubtotal });
          }
        }),

      itemCount: () => get().items.reduce((acc, i) => acc + i.quantity, 0),
    }),
    {
      name: "cart-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // Only the coupon is persisted — items always come from the server, which is
      // authoritative on price and stock. Without this the coupon silently vanished
      // when the app was killed mid-checkout.
      partialize: (state) => ({ couponCode: state.couponCode }),
    }
  )
);
