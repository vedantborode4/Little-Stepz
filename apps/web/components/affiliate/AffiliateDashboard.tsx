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
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-2xl p-5 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-24 mb-4" />
              <div className="h-8 bg-gray-100 rounded w-16 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-20" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <AffiliateStatsCards stats={stats} />

      {/* Referral link */}
      <ReferralLinkCard />

      {/* Quick links */}
      <div className="grid sm:grid-cols-3 gap-5">
        {[
          { label: "View Clicks",      href: "/affiliate/clicks",      icon: <Link2 size={18} />,  desc: "See all unique visits from your link",    color: "bg-blue-50 text-blue-500" },
          { label: "View Commissions", href: "/affiliate/commissions", icon: <Clock size={18} />,  desc: "Track your earned commissions",            color: "bg-green-50 text-green-500" },
          { label: "Request Payout",   href: "/affiliate/payout",      icon: <ArrowRight size={18} />, desc: "Withdraw your pending balance",        color: "bg-orange-50 text-orange-500" },
        ].map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-shadow flex items-start gap-4 group"
          >
            <div className={`p-2.5 rounded-xl ${q.color} shrink-0`}>{q.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 group-hover:text-primary transition-colors">{q.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{q.desc}</p>
            </div>
            <ArrowRight size={15} className="text-gray-300 group-hover:text-primary transition-colors shrink-0 mt-0.5" />
          </Link>
        ))}
      </div>
    </div>
  )
}
