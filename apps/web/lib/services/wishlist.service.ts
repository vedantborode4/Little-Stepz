import { api } from "../api-client"

export const WishlistService = {
  get: async () => (await api.get("/wishlist")).data,

  add: async (productId: string) =>
    (await api.post("/wishlist", { productId })).data,

  remove: async (productId: string) =>
    (await api.delete(`/wishlist/${productId}`)).data,
}
