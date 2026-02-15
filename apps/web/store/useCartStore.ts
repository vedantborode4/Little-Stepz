import { create } from "zustand"
import { CartService } from "../lib/services/cart.service"
import type { CartItem } from "../types/cart"

interface AddItemPayload {
  productId: string
  variantId?: string
  quantity: number
  product?: any
  variant?: any
}

interface CartState {
  items: CartItem[]
  isLoading: boolean
  subtotal: number

  fetchCart: () => Promise<void>
  addItem: (payload: AddItemPayload) => Promise<void>
  updateQuantity: (
    productId: string,
    variantId: string | undefined,
    quantity: number
  ) => Promise<void>
  removeItem: (productId: string, variantId?: string) => Promise<void>
  clearCart: () => Promise<void>
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  subtotal: 0,
  isLoading: false,

  /* ---------------- FETCH ---------------- */

  fetchCart: async () => {
    set({ isLoading: true })
    try {
      const data = await CartService.getCart()
      set({
        items: data.items,
        subtotal: data.subtotal,
      })
    } finally {
      set({ isLoading: false })
    }
  },

  /* ---------------- ADD ---------------- */

  addItem: async (payload) => {
    const prev = get().items ?? []

    const existing = prev.find(
      (i) =>
        i.productId === payload.productId &&
        i.variantId === payload.variantId
    )

    const optimisticItem: CartItem = existing
      ? { ...existing, quantity: existing.quantity + payload.quantity }
      : {
          id: crypto.randomUUID(),
          productId: payload.productId,
          variantId: payload.variantId,
          quantity: payload.quantity,
          product: payload.product!,
          variant: payload.variant ?? null,
          subtotal:
            Number(payload.product!.price) * payload.quantity,
        }

    set({
      items: existing
        ? prev.map((i) =>
            i.productId === payload.productId &&
            i.variantId === payload.variantId
              ? optimisticItem
              : i
          )
        : [...prev, optimisticItem],
    })

    try {
      const data = await CartService.add({
        productId: payload.productId,
        variantId: payload.variantId,
        quantity: payload.quantity,
      })

      set({
        items: data.items,
        subtotal: data.subtotal,
      })
    } catch (e) {
      set({ items: prev })
      throw e
    }
  },

  /* ---------------- UPDATE QTY ---------------- */

  updateQuantity: async (productId, variantId, quantity) => {
    const prev = get().items ?? []

    set({
      items: prev.map((i) =>
        i.productId === productId && i.variantId === variantId
          ? { ...i, quantity }
          : i
      ),
    })

    try {
      const data = await CartService.update({
        productId,
        variantId,
        quantity,
      })

      set({
        items: data.items,
        subtotal: data.subtotal,
      })
    } catch {
      set({ items: prev })
    }
  },

  /* ---------------- REMOVE ---------------- */

  removeItem: async (productId, variantId) => {
    const prev = get().items ?? []

    set({
      items: prev.filter(
        (i) =>
          !(
            i.productId === productId &&
            i.variantId === variantId
          )
      ),
    })

    try {
      const data = await CartService.remove({
        productId,
        variantId,
      })

      set({
        items: data.items,
        subtotal: data.subtotal,
      })
    } catch {
      set({ items: prev })
    }
  },

  /* ---------------- CLEAR ---------------- */

  clearCart: async () => {
    const prev = get().items
    set({ items: [] })

    try {
      await CartService.clear()
      set({ subtotal: 0 })
    } catch {
      set({ items: prev })
    }
  },
}))
