import { create } from "zustand"
import { WishlistItem } from "../types/wishlist"

interface WishlistState {
  items: WishlistItem[]
  setWishlist: (items: WishlistItem[]) => void
}

export const useWishlistStore = create<WishlistState>((set) => ({
  items: [],
  setWishlist: (items) => set({ items }),
}))
