import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { CartService } from "../lib/services/cart.service"
import type { CartItem } from "../types/cart"

/* ---------------------------------- */
/* Types */
/* ---------------------------------- */

interface AddItemPayload {
  productId: string
  variantId?: string
  quantity: number
}

interface CartState {
  items: CartItem[]
  isLoading: boolean
  isServerCart: boolean

  fetchCart: () => Promise<void>
  addItem: (payload: AddItemPayload) => Promise<void>
  updateQuantity: (
    productId: string,
    variantId: string | undefined,
    quantity: number
  ) => Promise<void>
  removeItem: (productId: string, variantId?: string) => Promise<void>
  clearCart: () => Promise<void>
  syncCart: (sessionId: string) => Promise<void>

  getSubtotal: () => number
}

/* ---------------------------------- */
/* Store */
/* ---------------------------------- */

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,
      isServerCart: false,

      fetchCart: async () => {
        set({ isLoading: true })
        try {
          const data = await CartService.getCart()
          set({ items: data.items, isServerCart: true })
        } finally {
          set({ isLoading: false })
        }
      },

      addItem: async (payload) => {
        const { isServerCart, items } = get()

        if (!isServerCart) {
          const existing = items.find(
            (i) =>
              i.productId === payload.productId &&
              i.variantId === payload.variantId
          )

          if (existing) {
            existing.quantity += payload.quantity
            set({ items: [...items] })
          } else {
            set({ items: [...items, payload as CartItem] })
          }

          return
        }

        await CartService.add(payload)
        await get().fetchCart()
      },

      updateQuantity: async (productId, variantId, quantity) => {
        const { isServerCart, items } = get()

        if (!isServerCart) {
          set({
            items: items.map((i) =>
              i.productId === productId && i.variantId === variantId
                ? { ...i, quantity }
                : i
            ),
          })
          return
        }

        await CartService.update({ productId, variantId, quantity })
        await get().fetchCart()
      },

      removeItem: async (productId, variantId) => {
        const { isServerCart, items } = get()

        if (!isServerCart) {
          set({
            items: items.filter(
              (i) =>
                !(
                  i.productId === productId &&
                  i.variantId === variantId
                )
            ),
          })
          return
        }

        await CartService.remove({ productId, variantId })
        await get().fetchCart()
      },

      clearCart: async () => {
        const { isServerCart } = get()

        if (!isServerCart) {
          set({ items: [] })
          return
        }

        await CartService.clear()
        set({ items: [] })
      },

      syncCart: async (sessionId: string) => {
        await CartService.sync(sessionId)
        await get().fetchCart()
      },

      getSubtotal: () =>
        get().items.reduce(
          (acc, item) =>
            acc + Number(item.product.price) * item.quantity,
          0
        ),
    }),
    {
      name: "cart-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
)
