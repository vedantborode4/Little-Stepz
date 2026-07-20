import { Users, DollarSign, Wallet, TrendingUp } from "lucide-react"
import type { AffiliateStats } from "../../../lib/services/admin-affiliate.service"

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`

interface CardProps {
  label: string
  value: string
  sub: string
  icon: React.ReactNode
  color: string
}

function Card({ label, value, sub, icon, color }: CardProps) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-4">
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs text-muted font-medium">{label}</p>
        <div className={`p-1.5 rounded-lg ${color}`}>{icon}</div>
      </div>
      <p className="text-xl font-bold text-text">{value}</p>
      <p className="text-xs text-faint mt-0.5">{sub}</p>
    </div>
  )
}

/** Combined affiliate-program stats shown above the affiliates listing. */
export default function AffiliateStatsCards({ stats }: { stats: AffiliateStats | null }) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface border border-border rounded-2xl p-4 h-[92px] animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card
        label="Affiliates"
        value={stats.affiliates.total.toLocaleString()}
        sub={`${stats.affiliates.approved} approved · ${stats.affiliates.pending} pending`}
        icon={<Users size={14} />}
        color="bg-primary/10 text-primary"
      />
      <Card
        label="Commission Earned"
        value={inr(stats.commissions.earned)}
        sub={`${inr(stats.commissions.approved)} approved · ${inr(stats.commissions.paid)} paid`}
        icon={<DollarSign size={14} />}
        color="bg-green-500/10 text-green-600 dark:text-green-400"
      />
      <Card
        label="Withdrawals"
        value={inr(stats.withdrawals.pendingAmount)}
        sub={`${stats.withdrawals.pendingCount} pending · ${inr(stats.withdrawals.paid)} paid`}
        icon={<Wallet size={14} />}
        color="bg-amber-500/10 text-amber-600 dark:text-amber-400"
      />
      <Card
        label="Referral Revenue"
        value={inr(stats.referrals.revenue)}
        sub={`${stats.referrals.orders} orders · ${stats.referrals.signups} signups`}
        icon={<TrendingUp size={14} />}
        color="bg-blue-500/10 text-blue-600 dark:text-blue-400"
      />
    </div>
  )
}
