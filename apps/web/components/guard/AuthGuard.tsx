"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "../../store/auth.store"

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
      router.replace("/signin")
    }
  }, [isAuthenticated, isHydrated, router])

  if (!isHydrated) return null

  if (!isAuthenticated) return null

  return <>{children}</>
}