"use client"

import { Loader2 } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { refreshSession } from "@/lib/api-client"
import { useAuthStore } from "@/store/auth.store"

const PASSWORD_PAGE = "/change-password"

/**
 * Restores the session from the httpOnly refresh cookie on first load (the access
 * token lives only in memory), then keeps users with a temporary password on the
 * change-password page until they set their own.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const status = useAuthStore((s) => s.status)
  const mustChangePassword = useAuthStore((s) => s.user?.mustChangePassword)

  useEffect(() => {
    if (status !== "unknown") return
    refreshSession().catch(() => useAuthStore.getState().clear())
  }, [status])

  useEffect(() => {
    if (status === "anonymous") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`)
    } else if (status === "authenticated" && mustChangePassword && pathname !== PASSWORD_PAGE) {
      router.replace(PASSWORD_PAGE)
    }
  }, [status, mustChangePassword, pathname, router])

  const ready = status === "authenticated" && (!mustChangePassword || pathname === PASSWORD_PAGE)
  if (!ready) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-surface-2 text-muted">
        <Loader2 className="animate-spin" size={22} aria-label="Loading" />
      </div>
    )
  }
  return <>{children}</>
}
