"use client"

import { useEffect, useState } from "react"
import { ShoppingCart, TrendingUp, Users, DollarSign, TrendingDown, Minus, AlertTriangle } from "lucide-react"
import { AdminService, type AdminStats } from "../../lib/services/admin.service"
import { AdminProductService } from "../../lib/services/admin-product.service"
import TableSkeleton from "../../components/admin/TableSkeleton"
import Link from "next/link"

function StatCard({ title, value, prefix = "", suffix = "", change, icon, color = "bg-primary/10 text-primary" }: any) {
  const isPos = change > 0
  const isNeg = change < 0
  return (
    <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2 sm:mb-3">
        <p className="text-xs sm:text-sm text-muted font-medium leading-tight">{title}</p>
        <div className={`p-1.5 sm:p-2 rounded-xl ${color} shrink-0 ml-2`}>{icon}</div>
      </div>
      <h2 className="text-xl sm:text-2xl font-bold text-text mb-1 truncate">
        {prefix}{typeof value === "number" ? value.toLocaleString("en-IN") : value}{suffix}
      </h2>
      {change !== undefined && (
        <div className="flex items-center gap-1.5">
          <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${isPos ? "bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400" : isNeg ? "bg-red-50 dark:bg-red-500/15 text-red-500 dark:text-red-400" : "bg-surface-2 text-muted"}`}>
            {isPos ? <TrendingUp size={10} /> : isNeg ? <TrendingDown size={10} /> : <Minus size={10} />}
            {Math.abs(change)}%
          </span>
          <span className="text-xs text-faint hidden sm:inline">vs last period</span>
        </div>
      )}
    </div>
  )
}

function RevenueChart({ data }: { data: Array<{ day: string; revenue: number; orders: number }> }) {
  if (!data.length) return <div className="h-40 flex items-center justify-center text-faint text-sm">No revenue data yet</div>
  const revenues = data.map(d => d.revenue)
  const min = Math.min(...revenues) * 0.8
  const max = Math.max(...revenues) * 1.1 || 1
  const range = max - min || 1
  const W = 480, H = 200
  const pad = { top: 10, right: 10, bottom: 30, left: 48 }
  const w = W - pad.left - pad.right
  const h = H - pad.top - pad.bottom

  const pts = data.map((d, i) => ({
    x: pad.left + (i / Math.max(data.length - 1, 1)) * w,
    y: pad.top + h - ((d.revenue - min) / range) * h,
  }))
  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
  const lastPt = pts[pts.length - 1]!
  const firstPt = pts[0]!
  const fillD = `${pathD} L${lastPt.x},${pad.top + h} L${firstPt.x},${pad.top + h} Z`
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({ val: min + t * range, y: pad.top + h - t * h }))
  const labelStep = Math.max(1, Math.floor(data.length / 6))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity={0.2} />
          <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
        </linearGradient>
      </defs>
      {yTicks.map(({ val, y }) => (
        <g key={val}>
          <line x1={pad.left} y1={y} x2={pad.left + w} y2={y} stroke="#f1f5f9" strokeWidth={1} />
          <text x={pad.left - 6} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">
            {val >= 1000 ? `₹${(val / 1000).toFixed(0)}k` : `₹${Math.round(val)}`}
          </text>
        </g>
      ))}
      {data.map((d, i) => {
        if (i % labelStep !== 0 && i !== data.length - 1) return null
        return (
          <text key={i} x={pts[i]!.x} y={H - 6} textAnchor="middle" fontSize={9} fill="#9ca3af">
            {new Date(d.day).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </text>
        )
      })}
      <path d={fillD} fill="url(#areaGrad)" />
      <path d={pathD} fill="none" stroke="#22c55e" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function StatusDonut({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).filter(([, v]) => v > 0)
  if (!entries.length) return <div className="h-20 flex items-center justify-center text-faint text-sm">No orders yet</div>
  const COLORS = ["#4ECDC4", "#a78bfa", "#fbbf24", "#38bdf8", "#f87171", "#86efac", "#fb923c", "#e879f9"]
  const total = entries.reduce((s, [, v]) => s + v, 0)
  let angle = -Math.PI / 2
  const slices = entries.map(([key, val], i) => {
    const start = angle; const sweep = (val / total) * 2 * Math.PI; angle += sweep
    return { key, val, start, sweep, color: COLORS[i % COLORS.length] }
  })
  const arc = (cx: number, cy: number, r: number, ir: number, start: number, sweep: number) => {
    const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start)
    const x2 = cx + r * Math.cos(start + sweep), y2 = cy + r * Math.sin(start + sweep)
    const laf = sweep > Math.PI ? 1 : 0
    const ix1 = cx + ir * Math.cos(start + sweep), iy1 = cy + ir * Math.sin(start + sweep)
    const ix2 = cx + ir * Math.cos(start), iy2 = cy + ir * Math.sin(start)
    return `M${x1},${y1} A${r},${r} 0 ${laf} 1 ${x2},${y2} L${ix1},${iy1} A${ir},${ir} 0 ${laf} 0 ${ix2},${iy2} Z`
  }
  return (
    <div className="space-y-3">
      <div className="flex justify-center">
        <svg viewBox="0 0 150 150" width={120} height={120}>
          {slices.map((s) => (<path key={s.key} d={arc(75, 75, 70, 42, s.start, s.sweep)} fill={s.color} />))}
          <text x={75} y={78} textAnchor="middle" fontSize={14} fontWeight={700} fill="#1f2937">{total}</text>
          <text x={75} y={91} textAnchor="middle" fontSize={8} fill="#9ca3af">orders</text>
        </svg>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {slices.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-muted truncate">{s.key.replace(/_/g, " ")}</span>
            <span className="ml-auto font-medium text-text">{s.val}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    Promise.all([
      AdminService.getStats(),
      AdminProductService.getProducts({ page: 1, limit: 8, sort: "createdAt:desc" }),
    ])
      .then(([s, p]) => { setStats(s); setProducts(p.products || []) })
      .catch(e => setError(e?.response?.data?.message || "Failed to load dashboard"))
      .finally(() => setLoading(false))
  }, [])

  const kpis = stats?.kpis
  const revenueChart = stats?.revenueChart ?? []

  return (
    <div className="space-y-5 sm:space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30 rounded-xl p-4 flex items-center gap-3 text-red-700 dark:text-red-300 text-sm">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* KPI Cards — 2 col mobile, 4 col desktop */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-5">
        <StatCard title="Revenue (30d)" value={loading ? "—" : kpis?.revenueLast30d ?? 0} prefix="₹" icon={<DollarSign size={15}/>} color="bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400"/>
        <StatCard title="Total Orders" value={loading ? "—" : kpis?.totalOrders ?? 0} icon={<ShoppingCart size={15}/>} color="bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400"/>
        <StatCard title="Total Users" value={loading ? "—" : kpis?.totalUsers ?? 0} icon={<Users size={15}/>} color="bg-purple-50 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400"/>
        <StatCard title="Avg Order" value={loading ? "—" : Math.round(kpis?.avgOrderValue ?? 0)} prefix="₹" icon={<TrendingUp size={15}/>} color="bg-primary/10 text-primary"/>
      </div>

      {/* Secondary stats — 2 col mobile, 4 col desktop */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Orders Today",       value: kpis?.ordersToday ?? 0,       color: "text-blue-600 dark:text-blue-400" },
          { label: "Low Stock",          value: kpis?.lowStockProducts ?? 0,  color: "text-orange-500 dark:text-orange-400" },
          { label: "Pending Affiliates", value: kpis?.pendingAffiliates ?? 0, color: "text-purple-600 dark:text-purple-400" },
          { label: "Pending Returns",    value: kpis?.pendingReturns ?? 0,    color: "text-red-500 dark:text-red-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-surface border border-border rounded-xl p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs text-muted mb-1 leading-tight">{label}</p>
            <p className={`text-lg sm:text-xl font-bold ${color}`}>{loading ? "—" : value}</p>
          </div>
        ))}
      </div>

      {/* Revenue chart + Status donut — stacked on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        <div className="lg:col-span-2 bg-surface border border-border rounded-2xl p-4 sm:p-5">
          <div className="flex items-start sm:items-center justify-between mb-4 gap-2">
            <div>
              <h3 className="font-semibold text-text text-sm sm:text-base">Revenue (Last 30 Days)</h3>
              <p className="text-xs sm:text-sm text-faint mt-0.5">
                Total: ₹{(kpis?.revenueLast30d ?? 0).toLocaleString("en-IN")}
              </p>
            </div>
            <span className="text-xs text-faint bg-surface-2 border border-border px-2 py-1 rounded-lg shrink-0">
              {stats?.meta.rangeFrom ? new Date(stats.meta.rangeFrom).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""} → now
            </span>
          </div>
          {loading ? <div className="h-40 bg-surface-2 animate-pulse rounded-xl" /> : <RevenueChart data={revenueChart} />}
        </div>

        <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5">
          <h3 className="font-semibold text-text mb-4 text-sm sm:text-base">Orders by Status</h3>
          {loading ? <div className="h-32 bg-surface-2 animate-pulse rounded-xl" /> : <StatusDonut data={stats?.ordersByStatus ?? {}} />}
        </div>
      </div>

      {/* Top products + Commissions — stacked on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        <div className="lg:col-span-2 bg-surface border border-border rounded-2xl p-4 sm:p-5">
          <h3 className="font-semibold text-text mb-4 text-sm sm:text-base">Top Selling Products</h3>
          {loading ? <TableSkeleton rows={5} cols={4} /> : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-faint text-left border-b border-border">
                      <th className="pb-3 font-medium">Product</th>
                      <th className="pb-3 font-medium">Price</th>
                      <th className="pb-3 font-medium">Stock</th>
                      <th className="pb-3 font-medium text-right">Orders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats?.topProducts.map(p => {
                      const product = products.find(pr => pr.id === p.productId)
                      return (
                        <tr key={p.productId} className="border-b border-border hover:bg-surface-2/50 transition">
                          <td className="py-3">
                            <div className="flex items-center gap-2.5">
                              {product?.images?.[0]?.url && (
                                <img src={product.images[0].url} className="w-8 h-8 object-cover rounded-lg border border-border shrink-0" alt={p.name}/>
                              )}
                              <span className="font-medium text-text truncate max-w-[160px]">{p.name}</span>
                            </div>
                          </td>
                          <td className="py-3 text-muted">₹{product?.price?.toLocaleString() ?? "—"}</td>
                          <td className="py-3 text-muted">{product?.quantity ?? "—"}</td>
                          <td className="py-3 text-right font-semibold text-text">{p.totalOrders}</td>
                        </tr>
                      )
                    })}
                    {!stats?.topProducts.length && !loading && (
                      <tr><td colSpan={4} className="py-10 text-center text-faint">No sales data yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Mobile card list */}
              <div className="sm:hidden divide-y divide-border">
                {stats?.topProducts.map(p => {
                  const product = products.find(pr => pr.id === p.productId)
                  return (
                    <div key={p.productId} className="py-3 flex items-center gap-3">
                      {product?.images?.[0]?.url && (
                        <img src={product.images[0].url} className="w-10 h-10 object-cover rounded-xl border border-border shrink-0" alt={p.name}/>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-text truncate text-sm">{p.name}</p>
                        <p className="text-xs text-faint">₹{product?.price?.toLocaleString() ?? "—"} · Stock: {product?.quantity ?? "—"}</p>
                      </div>
                      <span className="font-bold text-text text-sm shrink-0">{p.totalOrders} orders</span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5">
          <h3 className="font-semibold text-text mb-4 text-sm sm:text-base">Commissions Summary</h3>
          {loading ? <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-16 bg-surface-2 animate-pulse rounded-xl"/>)}</div> : (
            <div className="space-y-3">
              {[
                { label: "Pending",  data: stats?.commissions.pending,  color: "bg-yellow-50 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-100 dark:border-yellow-500/20" },
                { label: "Approved", data: stats?.commissions.approved, color: "bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-300 border-green-100 dark:border-green-500/20" },
              ].map(({ label, data, color }) => (
                <div key={label} className={`border rounded-xl p-3 ${color}`}>
                  <p className="text-xs font-medium mb-1">{label}</p>
                  <p className="text-lg font-bold">₹{(data?.amount ?? 0).toLocaleString("en-IN")}</p>
                  <p className="text-xs opacity-70">{data?.count ?? 0} commissions</p>
                </div>
              ))}
              <div className="border border-border rounded-xl p-3 bg-surface-2">
                <p className="text-xs text-muted mb-1">Payment Success Rate</p>
                <p className="text-lg font-bold text-text">{stats?.payments.successRate ?? "—"}</p>
                <p className="text-xs text-faint">{stats?.payments.totalSuccess ?? 0} successful</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Links — 2 col mobile, 4 col desktop */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Manage Orders",     href: "/admin/orders",    color: "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-500/20" },
          { label: "Manage Products",   href: "/admin/products",  color: "bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-300 border-green-100 dark:border-green-500/20" },
          { label: "Manage Affiliates", href: "/admin/affiliates",color: "bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-100 dark:border-purple-500/20" },
          { label: "Manage Coupons",    href: "/admin/coupons",   color: "bg-yellow-50 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-100 dark:border-yellow-500/20" },
        ].map(({ label, href, color }) => (
          <Link key={href} href={href}
            className={`border rounded-xl p-3 sm:p-4 text-xs sm:text-sm font-medium text-center hover:shadow-sm transition ${color}`}>
            {label}
          </Link>
        ))}
      </div>
    </div>
  )
}
