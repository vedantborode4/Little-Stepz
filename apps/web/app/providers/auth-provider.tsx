"use client"

import { useEffect, useState } from "react"
import { useAuthStore } from "../../store/auth.store"
import { getAccessToken, removeAccessToken } from "../../lib/utils/token"
import { UserService } from "../../lib/services/user.service"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setAuth, logout } = useAuthStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const hydrate = async () => {
      const token = getAccessToken()

      if (!token) {
        setLoading(false)
        return
      }

      try {
        const user = await UserService.getMe()

        setAuth({
          accessToken: token,
          user,
        } as any)
      } catch {
        removeAccessToken()
        logout()
      } finally {
        setLoading(false)
      }
    }

    hydrate()
  }, [setAuth, logout])

  if (loading) return null

  return children
}
