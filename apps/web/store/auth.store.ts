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
        useCartStore.getState().clearCart()

        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
        })
      },

      setHydrated: (value) => set({ isHydrated: value }),
    }),
    { name: "auth-storage" }
  )
)