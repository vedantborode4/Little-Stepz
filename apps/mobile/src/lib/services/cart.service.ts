import { api } from "../api/client";
import type { AddCartItemBody } from "@repo/zod-schema/index";
import type { CartResponse } from "../../types/cart";

export const CartService = {
  getCart: async (): Promise<CartResponse> => {
    const res = await api.get("/cart");
    return res.data.data;
  },
  add: async (data: AddCartItemBody): Promise<CartResponse> => {
    const res = await api.post("/cart/add", data);
    return res.data.data;
  },
  update: async (data: AddCartItemBody): Promise<CartResponse> => {
    const res = await api.put("/cart/update", data);
    return res.data.data;
  },
  remove: async (data: { productId: string; variantId?: string }): Promise<CartResponse> => {
    const res = await api.delete("/cart/remove", { data });
    return res.data.data;
  },
  clear: async () => {
    const res = await api.delete("/cart/clear");
    return res.data.data;
  },
  sync: async (sessionId: string) => {
    const res = await api.post("/cart/sync", { sessionId });
    return res.data.data;
  },
};
