"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "../../store/auth.store"
import { safeRedirectTarget } from "../../lib/utils/redirect"

export default function GuestGuard({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { isAuthenticated, isHydrated } = useAuthStore()
  const hasRedirected = useRef(false)

  // Captured on mount, NOT read at redirect time. The sign-in page navigates to the
  // target first, which strips ?redirect= from the URL; reading it later therefore
  // always saw "no target" and sent the user to "/" instead.
  const target = useRef<string | null>(null)
  if (target.current === null) target.current = safeRedirectTarget()

  useEffect(() => {
    if (!isHydrated) return
    if (isAuthenticated && !hasRedirected.current) {
      hasRedirected.current = true
      // Honour ?redirect= like the sign-in page does. Hard-coding "/" here raced the
      // page's own router.push and always won, so a customer bounced here from an
      // order link signed in and landed on the homepage — for password AND Google.
      router.replace(target.current ?? "/")
    }
  }, [isAuthenticated, isHydrated, router])

  if (!isHydrated) return null

  if (isAuthenticated) return null

  return <>{children}</>
}