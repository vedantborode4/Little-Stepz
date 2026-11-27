import { api } from "../api/client";
import type { Product } from "../../types/product";

export interface ViralReel {
  id: string;
  reelUrl: string;
  coverImageUrl: string;
  caption: string | null;
  /** Live products only, in the admin's order. Never empty. */
  products: Product[];
}

export const ViralReelService = {
  getAll: async (): Promise<ViralReel[]> => {
    const res = await api.get("/viral-reels");
    return res.data.data.reels;
  },
};
