"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "../../store/auth.store"

export default function GuestGuard({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { isAuthenticated, isHydrated } = useAuthStore()
  const hasRedirected = useRef(false)

  useEffect(() => {
    if (!isHydrated) return
    if (isAuthenticated && !hasRedirected.current) {
      hasRedirected.current = true
      router.replace("/")
    }
  }, [isAuthenticated, isHydrated, router])

  if (!isHydrated) return null

  if (isAuthenticated) return null

  return <>{children}</>
}