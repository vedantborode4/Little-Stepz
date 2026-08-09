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

      // Always attempts the request. Do NOT gate this on a client-readable token:
      // the backend's accessToken cookie is httpOnly, so the JS-visible copy is
      // absent for a whole browser session until something triggers a refresh.
      // Short-circuiting here skipped axios entirely, which meant the 401-refresh
      // interceptor never ran and a signed-in user saw an empty wishlist.
      fetchWishlist: async () => {
        set({ isLoading: true })

        try {
          const data = await WishlistService.getWishlist()

          set({
            items: data.items.map((i: any) => i.product.id),
          })
        } catch (err: any) {
          // An expired session just means "no wishlist" — not a real failure.
          if (err?.response?.status === 401) {
            set({ items: [] })
            return
          }
          console.error(
            `[wishlist] Failed to load wishlist: ${err?.response?.data?.message ?? err?.message ?? "unknown error"}`
          )
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
