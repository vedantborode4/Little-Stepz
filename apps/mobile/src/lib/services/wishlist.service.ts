import { api } from "../api/client";

export interface WishlistItem {
  id: string;
  product: {
    id: string;
    name: string;
    slug: string;
    price: string;
    salePrice?: string | null;
    isOnSale?: boolean;
    priceDisplay?: "BOTH" | "REGULAR" | "SALE";
    images: { url: string }[];
  };
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
