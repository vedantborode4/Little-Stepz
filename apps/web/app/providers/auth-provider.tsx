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
  const { setAuth, logout, setHydrated } = useAuthStore()

  const fetchCart = useCartStore((s) => s.fetchCart)
  const fetchWishlist = useWishlistStore((s) => s.fetchWishlist)

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const hydrate = async () => {
      const token = getAccessToken()

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
  }, [setAuth, logout, fetchCart, fetchWishlist, setHydrated])

  if (loading) return null

  return children
}