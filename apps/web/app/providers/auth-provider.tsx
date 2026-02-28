"use client"

import { useEffect, useState } from "react"
import { useAuthStore } from "../../store/auth.store"
import { useCartStore } from "../../store/useCartStore"
import { useWishlistStore } from "../../store/useWishlistStore"
import {
  getAccessToken,
  removeAccessToken,
} from "../../lib/utils/token"
import { UserService } from "../../lib/services/user.service"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // ✅ FIX: Empty dependency array — this effect must only run ONCE on mount.
    //
    // The original bug: dependency array had [setAuth, logout, fetchCart, fetchWishlist, setHydrated].
    // Zustand recreates these function references on every render, so the effect
    // re-fired on every render → infinite hydrate() calls → continuous reload loop on signin page.
    //
    // Fix: Read store actions from getState() (always stable references) and use
    // an empty deps array so hydration only ever happens once on mount.
    const hydrate = async () => {
      const token = getAccessToken()

      const { setAuth, logout, setHydrated } = useAuthStore.getState()
      const { fetchCart } = useCartStore.getState()
      const { fetchWishlist } = useWishlistStore.getState()

      try {
        if (token) {
          const user = await UserService.getMe()
          setAuth({
            accessToken: token,
            user,
          } as any)
        }

        await fetchCart()

        if (token) {
          await fetchWishlist()
        }
      } catch {
        removeAccessToken()
        logout()
      } finally {
        setHydrated(true)
        setLoading(false)
      }
    }

    hydrate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // ← intentionally empty: hydrate must only run once on mount

  if (loading) return null

  return children
}
