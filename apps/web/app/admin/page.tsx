"use client"

import { useEffect, useState } from "react"
import { ShoppingCart, TrendingUp, Users, DollarSign, MoreHorizontal, TrendingDown, Minus } from "lucide-react"
import { AdminService } from "../../lib/services/admin.service"
import { AdminProductService } from "../../lib/services/admin-product.service"
import TableSkeleton from "../../components/admin/TableSkeleton"
import Link from "next/link"

/* ─── Stat Card ─── */
function StatCard({ title, value, prefix = "", change, icon, color = "bg-primary/10 text-primary" }: any) {
  const isPos = change > 0
  const isNeg = change < 0
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <div className="flex items-center gap-1">
          {icon && <div className={`p-2 rounded-xl ${color}`}>{icon}</div>}
          <MoreHorizontal size={14} className="text-gray-300 ml-1" />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        {prefix}{typeof value === "number" ? value.toLocaleString("en-IN") : value}
      </h2>
      {change !== undefined && (
        <div className="flex items-center gap-1.5">
          <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${isPos ? "bg-green-50 text-green-600" : isNeg ? "bg-red-50 text-red-500" : "bg-gray-100 text-gray-500"}`}>
            {isPos ? <TrendingUp size={10} /> : isNeg ? <TrendingDown size={10} /> : <Minus size={10} />}
            {Math.abs(change)}%
          </span>
          <span className="text-xs text-gray-400">more than last month</span>
        </div>
      )}
    </div>
  )
}

/* ─── Pure SVG line chart ─── */
function LineChart({ data, width = 480, height = 200 }: { data: number[]; width?: number; height?: number }) {
  if (!data.length) return null
  const min = Math.min(...data) * 0.8
  const max = Math.max(...data) * 1.1
  const range = max - min || 1
  const pad = { top: 10, right: 10, bottom: 30, left: 40 }
  const w = width - pad.left - pad.right
  const h = height - pad.top - pad.bottom

  const points = data.map((v, i) => ({
    x: pad.left + (i / (data.length - 1)) * w,
    y: pad.top + h - ((v - min) / range) * h,
  }))

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
  const fillD = `${pathD} L${points[points.length - 1].x},${pad.top + h} L${points[0].x},${pad.top + h} Z`

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"]
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({ val: Math.round(min + t * range), y: pad.top + h - t * h }))

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity={0.2} />
          <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
        </linearGradient>
      </defs>
      {yTicks.map(({ val, y }) => (
        <g key={val}>
          <line x1={pad.left} y1={y} x2={pad.left + w} y2={y} stroke="#f1f5f9" strokeWidth={1} />
          <text x={pad.left - 6} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">{(val / 1000).toFixed(0)}k</text>
        </g>
      ))}
      {months.slice(0, data.length).map((m, i) => {
        const x = pad.left + (i / (data.length - 1)) * w
        return <text key={m} x={x} y={height - 6} textAnchor="middle" fontSize={9} fill="#9ca3af">{m}</text>
      })}
      <path d={fillD} fill="url(#areaGrad)" />
      <path d={pathD} fill="none" stroke="#22c55e" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ─── Pure SVG pie chart ─── */
function PieChart({ data, cx = 75, cy = 75, r = 70, innerRadius = 0 }: { data: { value: number; color: string }[]; cx?: number; cy?: number; r?: number; innerRadius?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  let angle = -Math.PI / 2
  const slices = data.map(d => {
    const start = angle
    const sweep = (d.value / total) * 2 * Math.PI
    angle += sweep
    return { ...d, start, sweep }
  })

  const arc = (cx: number, cy: number, r: number, ir: number, start: number, sweep: number) => {
    const x1 = cx + r * Math.cos(start)
    const y1 = cy + r * Math.sin(start)
    const x2 = cx + r * Math.cos(start + sweep)
    const y2 = cy + r * Math.sin(start + sweep)
    const laf = sweep > Math.PI ? 1 : 0
    if (ir === 0) {
      return `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${laf} 1 ${x2},${y2} Z`
    }
    const ix1 = cx + ir * Math.cos(start + sweep)
    const iy1 = cy + ir * Math.sin(start + sweep)
    const ix2 = cx + ir * Math.cos(start)
    const iy2 = cy + ir * Math.sin(start)
    return `M${x1},${y1} A${r},${r} 0 ${laf} 1 ${x2},${y2} L${ix1},${iy1} A${ir},${ir} 0 ${laf} 0 ${ix2},${iy2} Z`
  }

  return (
    <svg viewBox={`0 0 ${cx * 2} ${cy * 2}`} width={cx * 2} height={cy * 2}>
      {slices.map((s, i) => (
        <path key={i} d={arc(cx, cy, r, innerRadius, s.start, s.sweep)} fill={s.color} />
      ))}
    </svg>
  )
}

/* ─── Colors ─── */
const SALES_COLORS = ["#4ECDC4", "#a78bfa", "#fbbf24", "#38bdf8"]
const CAT_COLORS = ["#86efac", "#38bdf8", "#fb923c", "#a78bfa", "#fde68a"]
const salesBreakdown = [
  { name: "Direct", value: 420.6 },
  { name: "Affiliate", value: 420.6 },
  { name: "Sponsored", value: 420.6 },
  { name: "Email", value: 420.6 },
]
const catBreakdown = [
  { name: "Direct", value: 2031.2 },
  { name: "Affiliate", value: 1840.2 },
  { name: "Sponsored", value: 1420.5 },
  { name: "Email", value: 835.2 },
  { name: "Other", value: 495.3 },
]

function generateRevenue(total: number) {
  const base = (total || 15360) / 10
  return Array.from({ length: 10 }, (_, i) =>
    Math.round(base * (0.4 + Math.sin(i * 0.8) * 0.3 + i * 0.08))
  )
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      AdminService.getStats(),
      AdminProductService.getProducts({ page: 1, limit: 8 }),
    ])
      .then(([s, p]) => { setStats(s); setProducts(p.products || []) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const revData = generateRevenue(stats?.totalRevenue)
  const currentWeek = revData[revData.length - 1] ?? 0
  const lastWeek = revData[revData.length - 2] ?? 0

  return (
    <div className="space-y-6">
      {/* STAT CARDS */}
      <div className="grid grid-cols-4 gap-5">
        <StatCard title="Total Sales" value={stats?.totalSales ?? "—"} prefix="₹" change={14} icon={<TrendingUp size={16}/>} color="bg-green-50 text-green-600"/>
        <StatCard title="Total Orders" value={stats?.totalOrders ?? "—"} change={-5} icon={<ShoppingCart size={16}/>} color="bg-blue-50 text-blue-600"/>
        <StatCard title="Total Revenue" value={stats?.totalRevenue ?? "—"} prefix="₹" change={14} icon={<DollarSign size={16}/>} color="bg-primary/10 text-primary"/>
        <StatCard title="Total Customers" value={stats?.totalCustomers ?? "—"} change={14} icon={<Users size={16}/>} color="bg-purple-50 text-purple-600"/>
      </div>

      {/* CHARTS ROW */}
      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Revenue</h3>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"/>Current week: ₹{currentWeek.toLocaleString()}</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block"/>Last week: ₹{lastWeek.toLocaleString()}</span>
            </div>
          </div>
          <LineChart data={revData} height={230} />
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Total Sales</h3>
          <div className="flex justify-center mb-3">
            <PieChart data={salesBreakdown.map((d, i) => ({ value: d.value, color: SALES_COLORS[i] }))} cx={75} cy={75} r={75} />
          </div>
          <div className="space-y-2">
            {salesBreakdown.map((item, i) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{backgroundColor:SALES_COLORS[i]}}/>
                  <span className="text-gray-600">{item.name}</span>
                </span>
                <span className="font-medium text-gray-900">₹{item.value.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PRODUCTS + CATEGORY */}
      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Top Selling Products</h3>
            <button className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition">
              Filter
            </button>
          </div>
          {loading ? <TableSkeleton rows={6} cols={5}/> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-left border-b border-gray-100">
                  <th className="pb-3 font-medium">Product Name</th>
                  <th className="pb-3 font-medium">Price</th>
                  <th className="pb-3 font-medium">Category</th>
                  <th className="pb-3 font-medium">Qty</th>
                  <th className="pb-3 font-medium">Sale</th>
                  <th className="pb-3 w-8"/>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                    <td className="py-3">
                      <div className="flex items-center gap-2.5">
                        <input type="checkbox" className="rounded accent-primary"/>
                        <span className="font-medium text-gray-800 truncate max-w-[160px]">{p.name}</span>
                      </div>
                    </td>
                    <td className="py-3 text-gray-700">₹{p.price}</td>
                    <td className="py-3 text-gray-500">{p.category?.name || "—"}</td>
                    <td className="py-3 text-gray-700">{p.quantity}</td>
                    <td className="py-3 font-semibold text-gray-900">₹{(p.price * p.quantity).toLocaleString()}</td>
                    <td className="py-3"><button className="text-gray-400 hover:text-gray-700"><MoreHorizontal size={16}/></button></td>
                  </tr>
                ))}
                {!products.length && <tr><td colSpan={6} className="py-10 text-center text-gray-400">No products yet</td></tr>}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Sales By Category</h3>
          <div className="flex justify-center mb-3">
            <PieChart data={catBreakdown.map((d, i) => ({ value: d.value, color: CAT_COLORS[i] }))} cx={75} cy={75} r={75} innerRadius={42} />
          </div>
          <div className="space-y-2">
            {catBreakdown.map((item, i) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{backgroundColor:CAT_COLORS[i]}}/>
                  <span className="text-gray-600">{item.name}</span>
                </span>
                <span className="font-medium text-gray-900">₹{item.value.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Manage Orders", href: "/admin/orders", color: "bg-blue-50 text-blue-700 border-blue-100" },
          { label: "Manage Products", href: "/admin/products", color: "bg-green-50 text-green-700 border-green-100" },
          { label: "Manage Affiliates", href: "/admin/affiliates", color: "bg-purple-50 text-purple-700 border-purple-100" },
          { label: "Manage Coupons", href: "/admin/coupons", color: "bg-yellow-50 text-yellow-700 border-yellow-100" },
        ].map(({ label, href, color }) => (
          <Link key={href} href={href} className={`border rounded-xl p-4 text-sm font-medium text-center hover:shadow-sm transition ${color}`}>
            {label}
          </Link>
        ))}
      </div>
    </div>
  )
}
