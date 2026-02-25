"use client"

import { useState, useEffect } from "react"
import { useAffiliateStore } from "../../store/affiliate.store"
import AffiliateStatsCards from "./AffiliateStatsCards"
import ReferralLinkCard from "./ReferralLinkCard"
import CommissionHistory from "./CommissionHistory"
import PayoutCard from "./PayoutCard"
import ClicksTable from "./ClicksTable"
import ConversionsTable from "./ConversionsTable"
import ReferredOrdersTable from "./ReferredOrdersTable"

const tabs = [
  "overview",
  "commissions",
  "conversions",
  "clicks",
  "orders",
  "payout",
]

export default function AffiliateDashboard() {
  const [active, setActive] = useState("overview")
  const { profile, stats, loading, fetchAffiliate } = useAffiliateStore()

  useEffect(() => {
    if (!profile) fetchAffiliate()
  }, [profile])

  if (loading || !profile) return <div className="py-24 text-center">Loading…</div>

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 grid lg:grid-cols-4 gap-8">

      {/* SIDEBAR */}
      <div className="bg-white border rounded-xl p-4 space-y-2 h-fit">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setActive(t)}
            className={`block w-full text-left px-3 py-2 rounded-lg text-sm ${
              active === t ? "bg-primary text-white" : "hover:bg-gray-100"
            }`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div className="lg:col-span-3 space-y-8">

        {active === "overview" && (
          <>
            <AffiliateStatsCards stats={stats} />
            <ReferralLinkCard />
          </>
        )}

        {active === "commissions" && <CommissionHistory />}
        {active === "clicks" && <ClicksTable />}
        {active === "conversions" && <ConversionsTable />}
        {active === "orders" && <ReferredOrdersTable />}
        {active === "payout" && <PayoutCard />}

      </div>
    </div>
  )
}