import { api } from "../api-client"

export const WishlistService = {
  getWishlist: async () => {
    const res = await api.get("/wishlist")
    return res.data.data
  },

  add: async (productId: string) => {
    await api.post("/wishlist", { productId })
  },

  remove: async (productId: string) => {
    await api.delete(`/wishlist/${productId}`)
  },
}
