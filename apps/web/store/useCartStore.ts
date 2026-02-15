import { create } from "zustand"
import { CartService } from "../lib/services/cart.service"
import type { CartItem } from "../types/cart"

interface AddItemPayload {
  productId: string
  variantId?: string
  quantity: number
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
    await CartService.add(payload)
    await get().fetchCart()
  },

  updateQuantity: async (productId, variantId, quantity) => {
    await CartService.update({ productId, variantId, quantity })
    await get().fetchCart()
  },

  removeItem: async (productId, variantId) => {
    await CartService.remove({ productId, variantId })
    await get().fetchCart()
  },

  clearCart: async () => {
    await CartService.clear()
    set({ items: [] })
  },

  getSubtotal: () =>
    get().items.reduce(
      (acc, item) => acc + Number(item.product.price) * item.quantity,
      0
    ),
}))
