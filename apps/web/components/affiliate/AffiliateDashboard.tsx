"use client"

import { useEffect } from "react"
import { useAffiliateStore } from "../../store/affiliate.store"
import AffiliateStatsCards from "./AffiliateStatsCards"
import ReferralLinkCard from "./ReferralLinkCard"
import { Link2, Clock, ArrowRight } from "lucide-react"
import Link from "next/link"

export default function AffiliateDashboard() {
  const { profile, stats, loading, fetchAffiliate } = useAffiliateStore()

  useEffect(() => {
    if (!profile) fetchAffiliate()
  }, [profile])

  if (loading || !profile) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-2xl p-4 sm:p-5 animate-pulse">
              <div className="h-4 bg-surface-2 rounded w-24 mb-4" />
              <div className="h-8 bg-surface-2 rounded w-16 mb-2" />
              <div className="h-3 bg-surface-2 rounded w-20" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Stats */}
      <AffiliateStatsCards stats={stats} />

      {/* Referral link */}
      <ReferralLinkCard />

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5">
        {[
          { label: "View Clicks",      href: "/affiliate/clicks",      icon: <Link2 size={18} />,     desc: "See all unique visits from your link",    color: "bg-blue-50 dark:bg-blue-500/15 text-blue-500 dark:text-blue-400" },
          { label: "View Commissions", href: "/affiliate/commissions", icon: <Clock size={18} />,     desc: "Track your earned commissions",            color: "bg-green-50 dark:bg-green-500/15 text-green-500 dark:text-green-400" },
          { label: "Request Payout",   href: "/affiliate/payout",      icon: <ArrowRight size={18} />, desc: "Withdraw your pending balance",           color: "bg-orange-50 dark:bg-orange-500/15 text-orange-500 dark:text-orange-400" },
        ].map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="bg-surface border border-border rounded-2xl p-4 sm:p-5 hover:shadow-md transition-shadow flex items-start gap-3 sm:gap-4 group"
          >
            <div className={`p-2.5 rounded-xl ${q.color} shrink-0`}>{q.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text group-hover:text-primary transition-colors">{q.label}</p>
              <p className="text-xs text-faint mt-0.5">{q.desc}</p>
            </div>
            <ArrowRight size={15} className="text-faint group-hover:text-primary transition-colors shrink-0 mt-0.5" />
          </Link>
        ))}
      </div>
    </div>
  )
}
