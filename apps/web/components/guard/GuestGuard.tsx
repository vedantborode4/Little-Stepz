"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "../../store/auth.store"

export default function GuestGuard({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { isAuthenticated, isHydrated } = useAuthStore()

  useEffect(() => {
    if (!isHydrated) return

    if (isAuthenticated) {
      router.replace("/")
    }
  }, [isAuthenticated, isHydrated, router])

  if (!isHydrated) return null

  if (isAuthenticated) return null

  return <>{children}</>
}