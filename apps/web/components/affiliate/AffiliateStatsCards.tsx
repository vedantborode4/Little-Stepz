import { MousePointerClick, ArrowLeftRight, DollarSign, Wallet, TrendingUp } from "lucide-react"

interface Props { stats: any }

export default function AffiliateStatsCards({ stats }: Props) {
  const overview = stats?.overview ?? stats ?? {}
  const recent   = stats?.recent   ?? {}

  const cards = [
    {
      label: "Total Clicks",
      value: overview.totalClicks      ?? 0,
      sub:   `${recent.clicksLast7Days ?? 0} this week`,
      icon:  <MousePointerClick size={18} />,
      color: "bg-blue-50 dark:bg-blue-500/15 text-blue-500 dark:text-blue-400",
    },
    {
      label: "Conversions",
      value: overview.totalConversions ?? 0,
      sub:   overview.conversionRate ? `${overview.conversionRate} rate` : "0.00% rate",
      icon:  <ArrowLeftRight size={18} />,
      color: "bg-violet-50 dark:bg-violet-500/15 text-violet-500 dark:text-violet-400",
    },
    {
      label: "Total Commission",
      value: `₹${(overview.totalCommission ?? 0).toLocaleString("en-IN")}`,
      sub:   `${overview.commissionType ?? "LIFETIME"} · ${((overview.commissionRate ?? 0) * 100).toFixed(0)}%`,
      icon:  <DollarSign size={18} />,
      color: "bg-green-50 dark:bg-green-500/15 text-green-500 dark:text-green-400",
    },
    {
      label: "Pending Balance",
      value: `₹${(overview.pendingBalance ?? 0).toLocaleString("en-IN")}`,
      sub:   `₹${(overview.paidOutBalance ?? 0).toLocaleString("en-IN")} paid out`,
      icon:  <Wallet size={18} />,
      color: "bg-orange-50 dark:bg-orange-500/15 text-orange-500 dark:text-orange-400",
    },
  ]

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-5">
      {cards.map((c) => (
        <div key={c.label} className="bg-surface border border-border rounded-2xl p-4 sm:p-5 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-2 sm:mb-3">
            <p className="text-xs sm:text-sm text-muted font-medium leading-tight">{c.label}</p>
            <div className={`p-1.5 sm:p-2 rounded-xl ${c.color} shrink-0 ml-1`}>{c.icon}</div>
          </div>
          <h2 className="text-lg sm:text-2xl font-bold text-text mb-1 truncate">{c.value}</h2>
          <p className="text-[10px] sm:text-xs text-faint flex items-center gap-1 truncate">
            <TrendingUp size={11} className="text-green-400 shrink-0" />
            {c.sub}
          </p>
        </div>
      ))}
    </div>
  )
}
