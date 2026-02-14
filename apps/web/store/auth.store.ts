import { create } from "zustand"
import { persist } from "zustand/middleware"
import { AuthResponse } from "../types/auth"

interface AuthState {
  user: AuthResponse["user"] | null
  accessToken: string | null
  setAuth: (data: AuthResponse) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,

      setAuth: (data) =>
        set({
          user: data.user,
          accessToken: data.accessToken,
        }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
        }),
    }),
    { name: "auth-storage" }
  )
)
