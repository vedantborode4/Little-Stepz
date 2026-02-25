export default function AffiliateStatsCards({ stats }: { stats: any }) {
  const items = [
    { label: "Clicks", value: stats?.clicks || 0 },
    { label: "Conversions", value: stats?.conversions || 0 },
    { label: "Revenue", value: `₹${stats?.revenue || 0}` },
    { label: "Commission", value: `₹${stats?.commission || 0}` },
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