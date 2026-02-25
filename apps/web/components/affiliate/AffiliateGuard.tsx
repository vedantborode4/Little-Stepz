"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "../../store/auth.store"
import { useAffiliateStore } from "../../store/affiliate.store"

export default function AffiliateGuard({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()

  const { user, isHydrated } = useAuthStore()
  const { profile, loading, fetchAffiliate } = useAffiliateStore()

  /* ---------------- AUTH GUARD ---------------- */

  useEffect(() => {
    if (isHydrated && !user) {
      router.replace("/signin")
    }
  }, [user, isHydrated, router])

  /* ---------------- FETCH PROFILE ---------------- */

  useEffect(() => {
    if (user && !profile) {
      fetchAffiliate()
    }
  }, [user, profile, fetchAffiliate])

  /* ---------------- REDIRECT IF NOT AFFILIATE ---------------- */

  useEffect(() => {
    if (!loading && user && !profile) {
      router.replace("/affiliate/apply")
    }
  }, [loading, profile, user, router])

  /* ---------------- STATES ---------------- */

  if (!isHydrated || loading) {
    return (
      <div className="py-24 text-center text-muted">
        Loading affiliate panel…
      </div>
    )
  }

  if (!profile) return null

  if (profile.status === "PENDING") {
    return (
      <div className="py-24 text-center space-y-3">
        <h2 className="text-xl font-semibold">
          Your affiliate application is under review
        </h2>
        <p className="text-muted text-sm">
          This usually takes 24–48 hours.
        </p>
      </div>
    )
  }

  if (profile.status === "REJECTED") {
    return (
      <div className="py-24 text-center space-y-4">
        <h2 className="text-xl font-semibold text-red-500">
          Application rejected
        </h2>

        <button
          onClick={() => router.push("/affiliate/apply")}
          className="bg-primary text-white px-6 py-2 rounded-lg"
        >
          Re-apply
        </button>
      </div>
    )
  }

  return <>{children}</>
}