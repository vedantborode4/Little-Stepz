"use client"

import { useAuthStore } from "../../store/auth.store"
import { useAffiliateStore } from "../../store/affiliate.store"
import { usePathname } from "next/navigation"

const routeLabels: Record<string, string> = {
  "/affiliate":             "Overview",
  "/affiliate/clicks":      "Clicks",
  "/affiliate/conversions": "Conversions",
  "/affiliate/commissions": "Commissions",
  "/affiliate/orders":      "Referred Orders",
  "/affiliate/payout":      "Payout",
}

export default function AffiliateTopbar() {
  const { user } = useAuthStore()
  const { profile } = useAffiliateStore()
  const pathname = usePathname()

  const pageLabel = Object.entries(routeLabels)
    .filter(([key]) => pathname.startsWith(key))
    .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? "Affiliate"

  return (
    <div className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6">
      <div>
        <h1 className="text-sm font-semibold text-gray-900">{pageLabel}</h1>
        {profile?.referralCode && (
          <p className="text-xs text-gray-400">Code: <span className="font-mono font-medium text-gray-600">{profile.referralCode}</span></p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Commission rate badge */}
        {profile?.commissionRate != null && (
          <div className="hidden sm:flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1.5 rounded-full text-xs font-semibold">
            <span>{(profile.commissionRate * 100).toFixed(0)}% commission</span>
          </div>
        )}

        {/* User avatar */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-sm font-semibold">
            {user?.name?.[0]?.toUpperCase() ?? "A"}
          </div>
          <span className="text-sm font-medium text-gray-700 hidden sm:block">
            {user?.name ?? "Affiliate"}
          </span>
        </div>
      </div>
    </div>
  )
}
