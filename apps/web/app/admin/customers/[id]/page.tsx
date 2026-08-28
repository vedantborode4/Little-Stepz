"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, Mail, Phone, MapPin, ShoppingBag, Wallet, TrendingUp,
  Calendar, Star, Globe, BadgeCheck, type LucideIcon,
} from "lucide-react"
import {
  AdminCustomerService,
  type AdminCustomerDetail,
} from "../../../../lib/services/admin-customer.service"
import AdminPageHeader from "../../../../components/admin/AdminPageHeader"

const inr = (n: number | string) =>
  `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const dt = (d: string | null) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"

const day = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"

const STATUS_TONE: Record<string, string> = {
  DELIVERED: "bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400",
  SHIPPED:   "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400",
  CONFIRMED: "bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400",
  PENDING:   "bg-surface-2 text-muted",
  CANCELLED: "bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400",
}

function Stat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-4">
      <div className="flex items-center gap-2 text-faint">
        <Icon size={14} />
        <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1.5 text-lg font-bold text-text">{value}</p>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-surface border border-border rounded-2xl overflow-hidden">
      <div className="px-4 sm:px-5 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-text">{title}</h2>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  )
}

export default function AdminCustomerDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<AdminCustomerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!params?.id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await AdminCustomerService.get(params.id)
        if (!cancelled) setData(res)
      } catch {
        if (!cancelled) setError("Couldn't load this customer.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [params?.id])

  if (loading) {
    return <div className="animate-pulse space-y-4">
      <div className="h-8 w-48 bg-surface-2 rounded-lg" />
      <div className="h-24 bg-surface-2 rounded-2xl" />
      <div className="h-64 bg-surface-2 rounded-2xl" />
    </div>
  }

  if (error || !data) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-10 text-center space-y-3">
        <p className="text-sm text-muted">{error ?? "Customer not found."}</p>
        <button onClick={() => router.push("/admin/customers")} className="text-sm text-primary font-medium hover:underline">
          Back to customers
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <button
        onClick={() => router.push("/admin/customers")}
        className="flex items-center gap-1.5 text-sm text-muted hover:text-text transition"
      >
        <ArrowLeft size={15} /> Customers
      </button>

      <AdminPageHeader
        title={data.name}
        subtitle={`Customer since ${day(data.createdAt)}`}
      />

      {/* Contact */}
      <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 grid gap-2.5 sm:grid-cols-2">
        <p className="flex items-center gap-2 text-sm text-muted">
          <Mail size={15} className="text-faint shrink-0" />
          <a href={`mailto:${data.email}`} className="hover:text-primary break-all">{data.email}</a>
          {data.emailVerified && <BadgeCheck size={14} className="text-green-500 shrink-0" />}
        </p>
        <p className="flex items-center gap-2 text-sm text-muted">
          <Phone size={15} className="text-faint shrink-0" />
          {data.phone ? <a href={`tel:${data.phone}`} className="hover:text-primary">{data.phone}</a> : "No phone on file"}
        </p>
        {data.affiliate && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Globe size={15} className="text-faint shrink-0" />
            Affiliate ({data.affiliate.status}) · code {data.affiliate.referralCode}
          </p>
        )}
        {data.referredBy && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Globe size={15} className="text-faint shrink-0" />
            Referred by {data.referredBy.name}
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={ShoppingBag} label="Paid orders" value={String(data.stats.orders)} />
        <Stat icon={Wallet} label="Total spend" value={inr(data.stats.totalSpend)} />
        <Stat icon={TrendingUp} label="AOV" value={inr(data.stats.aov)} />
        <Stat icon={Calendar} label="Last order" value={day(data.stats.lastOrderAt)} />
      </div>

      {/* Orders */}
      <Card title={`Orders (${data.orders.length})`}>
        {data.orders.length === 0 ? (
          <p className="text-sm text-muted">This customer hasn&apos;t placed an order yet.</p>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:-mx-5">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-xs font-semibold text-muted uppercase tracking-wide border-b border-border">
                  <th className="px-4 sm:px-5 py-2">Order</th>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Payment</th>
                  <th className="px-4 sm:px-5 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((o) => (
                  <tr key={o.id} className="border-b border-border last:border-0">
                    <td className="px-4 sm:px-5 py-2.5">
                      <Link href={`/admin/orders/${o.id}`} className="text-primary hover:underline font-medium">
                        #{o.id.slice(0, 8)}
                      </Link>
                      <span className="text-faint text-xs ml-1.5">
                        {o._count.items} item{o._count.items === 1 ? "" : "s"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted whitespace-nowrap">{day(o.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_TONE[o.status] ?? "bg-surface-2 text-muted"}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted">
                      {o.payment ? `${o.payment.method} · ${o.payment.status}` : "—"}
                    </td>
                    <td className="px-4 sm:px-5 py-2.5 text-right font-medium text-text whitespace-nowrap">{inr(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Addresses */}
      <Card title={`Addresses (${data.addresses.length})`}>
        {data.addresses.length === 0 ? (
          <p className="text-sm text-muted">No saved addresses.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.addresses.map((a) => (
              <div key={a.id} className="rounded-xl border border-border p-3.5">
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-faint" />
                  <span className="text-sm font-medium text-text">{a.name}</span>
                  {a.isDefault && (
                    <span className="text-[9px] font-bold uppercase bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Default</span>
                  )}
                </div>
                <p className="text-xs text-muted mt-1.5 leading-relaxed">
                  {a.address}, {a.city}, {a.state} – {a.pincode}
                </p>
                <p className="text-xs text-faint mt-1">{a.phone}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add-to-cart activity */}
      <Card title="Recent add-to-cart activity">
        {data.cartActivity.length === 0 ? (
          <p className="text-sm text-muted">No add-to-cart events recorded yet.</p>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:-mx-5">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-xs font-semibold text-muted uppercase tracking-wide border-b border-border">
                  <th className="px-4 sm:px-5 py-2">When</th>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2 text-right">Qty</th>
                  <th className="px-4 sm:px-5 py-2">IP address</th>
                </tr>
              </thead>
              <tbody>
                {data.cartActivity.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-0">
                    <td className="px-4 sm:px-5 py-2.5 text-muted whitespace-nowrap">{dt(e.createdAt)}</td>
                    <td className="px-4 py-2.5 text-text">{e.product.name}</td>
                    <td className="px-4 py-2.5 text-right text-muted">{e.quantity}</td>
                    <td className="px-4 sm:px-5 py-2.5 font-mono text-xs text-muted">{e.ip ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Reviews */}
      {data.reviews.length > 0 && (
        <Card title={`Reviews (${data.reviews.length})`}>
          <div className="space-y-3">
            {data.reviews.map((r) => (
              <div key={r.id} className="rounded-xl border border-border p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <Link href={`/products/${r.product.slug}`} className="text-sm font-medium text-text hover:text-primary truncate">
                    {r.product.name}
                  </Link>
                  <span className="flex items-center gap-1 text-xs text-amber-500 shrink-0">
                    <Star size={12} fill="currentColor" /> {r.rating}
                  </span>
                </div>
                {r.comment && <p className="text-xs text-muted mt-1.5 leading-relaxed">{r.comment}</p>}
                <p className="text-[11px] text-faint mt-1.5">{day(r.createdAt)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
