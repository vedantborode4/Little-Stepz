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
      color: "bg-blue-50 text-blue-500",
    },
    {
      label: "Conversions",
      value: overview.totalConversions ?? 0,
      sub:   overview.conversionRate ? `${overview.conversionRate} rate` : "0.00% rate",
      icon:  <ArrowLeftRight size={18} />,
      color: "bg-violet-50 text-violet-500",
    },
    {
      label: "Total Commission",
      value: `₹${(overview.totalCommission ?? 0).toLocaleString("en-IN")}`,
      sub:   `${overview.commissionType ?? "LIFETIME"} · ${((overview.commissionRate ?? 0) * 100).toFixed(0)}%`,
      icon:  <DollarSign size={18} />,
      color: "bg-green-50 text-green-500",
    },
    {
      label: "Pending Balance",
      value: `₹${(overview.pendingBalance ?? 0).toLocaleString("en-IN")}`,
      sub:   `₹${(overview.paidOutBalance ?? 0).toLocaleString("en-IN")} paid out`,
      icon:  <Wallet size={18} />,
      color: "bg-orange-50 text-orange-500",
    },
  ]

  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5">
      {cards.map((c) => (
        <div key={c.label} className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-3">
            <p className="text-sm text-gray-500 font-medium">{c.label}</p>
            <div className={`p-2 rounded-xl ${c.color}`}>{c.icon}</div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">{c.value}</h2>
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <TrendingUp size={11} className="text-green-400" />
            {c.sub}
          </p>
        </div>
      ))}
    </div>
  )
}
