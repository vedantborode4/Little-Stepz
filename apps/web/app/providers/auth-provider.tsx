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
  const { setAuth, logout } = useAuthStore()

  const fetchCart = useCartStore((s) => s.fetchCart)
  const syncCart = useCartStore((s) => s.syncCart)
  const fetchWishlist = useWishlistStore((s) => s.fetchWishlist)

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const hydrate = async () => {
      const token = getAccessToken()

      // 🚫 not logged in → render immediately
      if (!token) {
        setLoading(false)
        return
      }

      try {
        // 👤 restore user
        const user = await UserService.getMe()

        setAuth({
          accessToken: token,
          user,
        } as any)

        // 🛒 merge guest cart if exists
        const guestSessionId = localStorage.getItem("guest-cart-id")

        if (guestSessionId) {
          await syncCart(guestSessionId)
          localStorage.removeItem("guest-cart-id")
        }

        // ❤️🛒 hydrate server state in parallel
        await Promise.all([
          fetchCart(),
          fetchWishlist(),
        ])
      } catch (err) {
        removeAccessToken()
        logout()
      } finally {
        setLoading(false)
      }
    }

    hydrate()
  }, [setAuth, logout, fetchCart, fetchWishlist, syncCart])

  // ⛔ prevent UI flicker before hydration
  if (loading) return null

  return children
}
