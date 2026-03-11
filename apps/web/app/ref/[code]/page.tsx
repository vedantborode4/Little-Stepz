"use client"

import { useEffect } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { api } from "../../../lib/api-client"

const AFFILIATE_KEY = "affiliate_id"   // localStorage key
const COOKIE_NAME   = "ref"            // must match backend REFERRAL_COOKIE_NAME

/**
 * Referral landing page — /ref/[code]
 *
 * Flow:
 * 1. Fire POST /affiliate/track-click to record the click (no login required)
 * 2. Backend returns affiliateId (UUID)
 * 3. Persist affiliateId in:
 *    - localStorage (permanent, survives browser restarts)
 *    - Cookie "ref" (for server-side order attribution, 400-day expiry ≈ forever)
 * 4. Redirect to homepage (or ?redirect= param) — user never has to log in
 */
export default function ReferralPage() {
  const { code } = useParams<{ code: string }>()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!code) {
      window.location.replace("/")
      return
    }

    const track = async () => {
      try {
        const res = await api.post("/affiliate/track-click", { referralCode: code }, {
          headers: { "X-Browser-UA": navigator.userAgent },
        })
        const affiliateId: string | undefined = res.data?.data?.affiliateId

        if (affiliateId) {
          // 1. localStorage — permanent
          localStorage.setItem(AFFILIATE_KEY, affiliateId)

          // 2. Cookie — 400 days (≈ forever in browser terms)
          //    httpOnly=false so frontend can read it too
          const maxAge = 400 * 24 * 60 * 60  // seconds
          document.cookie = `${COOKIE_NAME}=${affiliateId}; path=/; max-age=${maxAge}; SameSite=Lax`
        }
      } catch {
        // Non-fatal — click may not be tracked but user still lands on site
      }

      // Redirect — default to homepage
      const redirect = searchParams.get("redirect") || "/"
      const safePath = redirect.startsWith("/") ? redirect : "/"
      window.location.replace(safePath)
    }

    track()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted">Just a moment…</p>
      </div>
    </div>
  )
}