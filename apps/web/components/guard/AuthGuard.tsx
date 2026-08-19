"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "../../store/auth.store"
import { signInUrl } from "../../lib/utils/redirect"

export default function AuthGuard({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { isAuthenticated, isHydrated } = useAuthStore()

  useEffect(() => {
    if (!isHydrated) return

    if (!isAuthenticated) {
      router.replace(signInUrl())
    }
  }, [isAuthenticated, isHydrated, router])

  if (!isHydrated) return null

  if (!isAuthenticated) return null

  return <>{children}</>
}