export default function AffiliateStatsCards({ stats }: { stats: any }) {
  const overview = stats?.overview ?? stats ?? {}

  const items = [
    { label: "Total Clicks",      value: overview.totalClicks      ?? 0 },
    { label: "Conversions",       value: overview.totalConversions ?? 0 },
    { label: "Total Commission",  value: `₹${overview.totalCommission ?? 0}` },
    { label: "Pending Balance",   value: `₹${overview.pendingBalance  ?? 0}` },
  ]

  return (
    <div className="grid md:grid-cols-4 gap-6">
      {items.map((i) => (
        <div key={i.label} className="bg-white border rounded-xl p-5">
          <p className="text-sm text-muted">{i.label}</p>
          <p className="text-xl font-bold text-primary">{i.value}</p>
        </div>
      ))}
    </div>
  )
}