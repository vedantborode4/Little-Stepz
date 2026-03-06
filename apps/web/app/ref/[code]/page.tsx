"use client"

import { useEffect } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { api } from "../../../lib/api-client"

/**
 * Referral click tracking page — /ref/[code]
 *
 * Flow:
 * 1. Record the click on the backend  POST /affiliate/track-click
 * 2. Persist the referral code in a cookie so checkout can attach it to the order
 * 3. Redirect to the page the affiliate linked to (redirect param) or the homepage
 *
 * This page renders nothing visible — it's a transparent redirect.
 */
export default function ReferralPage() {
  const { code } = useParams<{ code: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    if (!code) {
      router.replace("/")
      return
    }

    const track = async () => {
      // Persist ref code for checkout attribution (7-day cookie)
      document.cookie = `ref_code=${code}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`

      // Fire-and-forget click tracking — don't block the redirect
      try {
        await api.post("/affiliate/track-click", { referralCode: code })
      } catch {
        // Non-fatal: click may not be tracked if endpoint isn't ready,
        // but the referral cookie is already set for commission attribution.
      }

      // Redirect to the destination — default to home
      const redirect = searchParams.get("redirect") || "/"
      // Safety: only allow relative paths to prevent open-redirect
      const safePath = redirect.startsWith("/") ? redirect : "/"
      router.replace(safePath)
    }

    track()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  // Minimal loading UI while the redirect fires
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted">Redirecting you…</p>
      </div>
    </div>
  )
}
