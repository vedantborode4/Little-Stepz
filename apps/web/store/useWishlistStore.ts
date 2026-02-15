import { create } from "zustand"
import { WishlistService } from "../lib/services/wishlist.service"

interface WishlistState {
  items: string[]
  isLoading: boolean

  fetchWishlist: () => Promise<void>
  toggle: (productId: string) => Promise<void>
  isInWishlist: (productId: string) => boolean
}

export const useWishlistStore = create<WishlistState>((set, get) => ({
  items: [],
  isLoading: false,

  fetchWishlist: async () => {
    set({ isLoading: true })
    try {
      const data = await WishlistService.getWishlist()
      set({ items: data.map((i: any) => i.productId) })
    } finally {
      set({ isLoading: false })
    }
  },

  toggle: async (productId) => {
    const { items } = get()
    const exists = items.includes(productId)

    // 🔥 optimistic update
    set({
      items: exists
        ? items.filter((id) => id !== productId)
        : [...items, productId],
    })

    try {
      if (exists) {
        await WishlistService.remove(productId)
      } else {
        await WishlistService.add(productId)
      }
    } catch {
      // rollback on error
      set({ items })
    }
  },

  isInWishlist: (productId) => {
    return get().items.includes(productId)
  },
}))
