import { create } from "zustand"
import { persist } from "zustand/middleware"
import { WishlistService } from "../lib/services/wishlist.service"

interface WishlistState {
  items: string[]
  isLoading: boolean

  fetchWishlist: () => Promise<void>
  toggle: (productId: string) => Promise<void>
  isInWishlist: (productId: string) => boolean
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,

      fetchWishlist: async () => {
        set({ isLoading: true })

        try {
          const data = await WishlistService.getWishlist()

          // ✅ correct mapping for your backend
          set({
            items: data.items.map((i: any) => i.product.id),
          })
        } finally {
          set({ isLoading: false })
        }
      },

      isInWishlist: (productId) => get().items.includes(productId),

      toggle: async (productId) => {
        const prevItems = get().items
        const exists = prevItems.includes(productId)

        // ✅ optimistic update
        set({
          items: exists
            ? prevItems.filter((id) => id !== productId)
            : [...prevItems, productId],
        })

        try {
          if (exists) {
            await WishlistService.remove(productId)
          } else {
            await WishlistService.add(productId)
          }
        } catch (err: any) {
          // ✅ 409 = already exists → keep optimistic state
          if (err?.response?.status === 409) return

          // ❌ real error → rollback
          set({ items: prevItems })
        }
      },
    }),
    {
      name: "wishlist-storage",
      partialize: (state) => ({ items: state.items }),
    }
  )
)
