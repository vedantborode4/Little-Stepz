import { api } from "../api-client"
import { AddCartItemBody } from "@repo/zod-schema/index"

export const CartService = {
  getCart: async () => (await api.get("/cart")).data,

  add: async (data: AddCartItemBody) =>
    (await api.post("/cart/add", data)).data,

  update: async (data: AddCartItemBody) =>
    (await api.put("/cart/update", data)).data,

  remove: async (data: any) =>
    (await api.delete("/cart/remove", { data })).data,

  clear: async () => (await api.delete("/cart/clear")).data,

  sync: async (sessionId: string) =>
    (await api.post("/cart/sync", { sessionId })).data,
}
