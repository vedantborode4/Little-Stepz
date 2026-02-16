import { api } from "../api-client"
import { AddCartItemBody } from "@repo/zod-schema/index"

export const CartService = {
  getCart: async () => {
    const res = await api.get("/cart")
    return res.data.data   // ✅ FIXED
  },

  add: async (data: AddCartItemBody) => {
    const res = await api.post("/cart/add", data)
    return res.data.data   // ✅ keep consistent
  },

  update: async (data: AddCartItemBody) => {
    const res = await api.put("/cart/update", data)
    return res.data.data
  },

  remove: async (data: any) => {
    const res = await api.delete("/cart/remove", { data })
    return res.data.data
  },

  clear: async () => {
    const res = await api.delete("/cart/clear")
    return res.data.data
  },

  sync: async (sessionId: string) => {
    const res = await api.post("/cart/sync", { sessionId })
    return res.data.data
  },
}
