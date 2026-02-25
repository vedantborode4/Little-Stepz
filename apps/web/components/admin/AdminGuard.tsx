"use client"

import { useAuthStore } from "../../store/auth.store"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function AdminGuard({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { user, isHydrated } = useAuthStore()

  useEffect(() => {
    if (!isHydrated) return

    if (!user) {
      router.replace("/signin")
      return
    }

    if (user.role !== "ADMIN") {
      router.replace("/")
    }
  }, [user, isHydrated, router])

  if (!isHydrated || !user || user.role !== "ADMIN") {
    return (
      <div className="py-24 text-center text-muted">
        Checking admin access…
      </div>
    )
  }

  return <>{children}</>
}