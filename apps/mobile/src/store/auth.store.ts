import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthResponse, AuthUser } from "../types/auth";
import { useCartStore } from "./cart.store";
import { useWishlistStore } from "./wishlist.store";
import { useAddressStore } from "./address.store";

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isHydrated: boolean;

  setAuth: (data: AuthResponse) => void;
  setUserOnly: (user: AuthUser) => void;
  logout: () => void;
  setHydrated: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isHydrated: false,

      setAuth: (data) =>
        set({ user: data.user, isAuthenticated: true }),

      setUserOnly: (user) => set({ user }),

      logout: () => {
        // Clear cart state locally only — do NOT call clearCart() (would fire an
        // API call that 401s during forced logout and re-enters the interceptor).
        useCartStore.setState({
          items: [],
          subtotal: 0,
          total: 0,
          discount: 0,
          couponCode: null,
        });
        // The wishlist is persisted to AsyncStorage, so without this the next
        // person to sign in on this device sees the previous user's hearts.
        useWishlistStore.setState({ items: [] });
        // Saved addresses are personal data — never carry them into the next session.
        useAddressStore.getState().reset();
        set({ user: null, isAuthenticated: false });
      },

      setHydrated: (value) => set({ isHydrated: value }),
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // Token lives in SecureStore (token.ts), not in this AsyncStorage blob.
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
