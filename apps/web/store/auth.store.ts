import { create } from "zustand"
import { persist } from "zustand/middleware"
import { AuthResponse } from "../types/auth"
import { useCartStore } from "./useCartStore"

interface AuthState {
  user: AuthResponse["user"] | null
  accessToken: string | null

  isAuthenticated: boolean
  isHydrated: boolean

  setAuth: (data: AuthResponse) => void
  logout: () => void
  setHydrated: (value: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,

      isAuthenticated: false,
      isHydrated: false,

      setAuth: (data) =>
        set({
          user: data.user,
          accessToken: data.accessToken,
          isAuthenticated: true,
        }),

      logout: () => {
        // Clear cart state locally — do NOT call clearCart() which fires an API request.
        // During forced logout (e.g. refresh-token failure), that API call would 401,
        // re-enter the interceptor, and cause a cascading loop.
        useCartStore.setState({
          items: [],
          subtotal: 0,
          total: 0,
          discount: 0,
          couponCode: null,
        })

        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
        })
      },

      setHydrated: (value) => set({ isHydrated: value }),
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
        // isHydrated is intentionally excluded — runtime flag only
      }),
    }
  )
)