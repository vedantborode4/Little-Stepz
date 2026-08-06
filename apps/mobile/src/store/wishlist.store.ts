import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { WishlistService } from "../lib/services/wishlist.service";
import { queryClient, qk } from "../lib/api/query-client";
import { useAuthStore } from "./auth.store";
import { toast } from "./toast.store";

interface WishlistState {
  items: string[];
  isLoading: boolean;
  fetchWishlist: () => Promise<void>;
  toggle: (productId: string) => Promise<void>;
  isInWishlist: (productId: string) => boolean;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,

      fetchWishlist: async () => {
        set({ isLoading: true });
        try {
          const data = await WishlistService.getWishlist();
          set({ items: data.items.map((i) => i.product.id) });
        } catch {
          // guest / unauth — keep persisted local list
        } finally {
          set({ isLoading: false });
        }
      },

      isInWishlist: (productId) => get().items.includes(productId),

      toggle: async (productId) => {
        // The wishlist is auth-only on the backend, so a guest's request always 401s.
        // Say what to do about it instead of surfacing a generic failure toast.
        if (!useAuthStore.getState().isAuthenticated) {
          toast.info("Login to add to wishlist");
          router.push({ pathname: "/(auth)/signin", params: { redirect: "/(tabs)/wishlist" } });
          return;
        }

        const prevItems = get().items;
        const exists = prevItems.includes(productId);
        set({
          items: exists ? prevItems.filter((id) => id !== productId) : [...prevItems, productId],
        });
        try {
          if (exists) await WishlistService.remove(productId);
          else await WishlistService.add(productId);
          toast.success(exists ? "Removed from wishlist" : "Added to wishlist");
          // Keep the server-backed wishlist list (used by the Wishlist tab) in sync
          // so a removed item disappears from the grid immediately.
          queryClient.invalidateQueries({ queryKey: qk.wishlist });
        } catch (err: any) {
          if (err?.response?.status === 409) return; // already exists → keep
          set({ items: prevItems });
          toast.error("Couldn't update wishlist");
        }
      },
    }),
    {
      name: "wishlist-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);
