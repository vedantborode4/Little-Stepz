import { api } from "../api-client"

interface WishlistItem {
  id: string
  product: {
    id: string
    name: string
    slug: string
    price: string
    images: { url: string }[]
  }
}

interface WishlistResponse {
  items: WishlistItem[]
}

export const WishlistService = {
  getWishlist: async (): Promise<WishlistResponse> => {
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
