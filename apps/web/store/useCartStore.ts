import { create } from "zustand"
import { CartService } from "../lib/services/cart.service"
import type { CartItem } from "../types/cart"

interface AddItemPayload {
  productId: string
  variantId?: string
  quantity: number

  // ✅ optional → for optimistic UI
  product?: any
  variant?: any
}

interface CartState {
  items: CartItem[]
  isLoading: boolean

  fetchCart: () => Promise<void>
  addItem: (payload: AddItemPayload) => Promise<void>
  updateQuantity: (
    productId: string,
    variantId: string | undefined,
    quantity: number
  ) => Promise<void>
  removeItem: (productId: string, variantId?: string) => Promise<void>
  clearCart: () => Promise<void>

  getSubtotal: () => number
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  isLoading: false,

  fetchCart: async () => {
    set({ isLoading: true })
    try {
      const data = await CartService.getCart()
      set({ items: data.items })
    } finally {
      set({ isLoading: false })
    }
  },

  addItem: async (payload) => {
    const prevItems = get().items ?? []

    /* find existing */
    const existing = prevItems.find(
      (i) =>
        i.productId === payload.productId &&
        i.variantId === payload.variantId
    )

    /* optimistic item */
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

    /* optimistic update */
    set({
      items: existing
        ? prevItems.map((i) =>
            i.productId === payload.productId &&
            i.variantId === payload.variantId
              ? optimisticItem
              : i
          )
        : [...prevItems, optimisticItem],
    })

    try {
      const data = await CartService.add({
        productId: payload.productId,
        variantId: payload.variantId,
        quantity: payload.quantity,
      })

      set({ items: data.items })
    } catch (err) {
      set({ items: prevItems })
      throw err
    }
  },


  updateQuantity: async (productId, variantId, quantity) => {
    const prevItems = get().items

    set({
      items: prevItems.map((item) =>
        item.productId === productId &&
        item.variantId === variantId
          ? { ...item, quantity }
          : item
      ),
    })

    try {
      await CartService.update({ productId, variantId, quantity })
      await get().fetchCart()
    } catch {
      set({ items: prevItems })
    }
  },

  removeItem: async (productId, variantId) => {
    const prevItems = get().items

    set({
      items: prevItems.filter(
        (i) =>
          !(
            i.productId === productId &&
            i.variantId === variantId
          )
      ),
    })

    try {
      await CartService.remove({ productId, variantId })
    } catch {
      set({ items: prevItems })
    }
  },

  clearCart: async () => {
    const prevItems = get().items
    set({ items: [] })

    try {
      await CartService.clear()
    } catch {
      set({ items: prevItems })
    }
  },

  getSubtotal: () =>
    get().items.reduce((acc, item) => acc + item.subtotal, 0),
}))
