import { api } from "../api/client";
import type { Product } from "../../types/product";

export interface WishlistItem {
  id: string;
  /** The API returns a product-list-shaped payload, so the card can render it
   *  with the same stock/variant/pre-order rules as anywhere else. */
  product: Product;
}

export interface WishlistResponse {
  items: WishlistItem[];
}

export const WishlistService = {
  getWishlist: async (): Promise<WishlistResponse> => {
    const res = await api.get("/wishlist");
    return res.data.data;
  },
  add: async (productId: string) => {
    await api.post("/wishlist", { productId });
  },
  remove: async (productId: string) => {
    await api.delete(`/wishlist/${productId}`);
  },
};
