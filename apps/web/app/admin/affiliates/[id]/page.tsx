"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, User, Mail, Calendar, DollarSign, TrendingUp, Settings, MessageSquare, ShieldCheck } from "lucide-react"
import { AdminAffiliateService, AdminCommissionService } from "../../../../lib/services/admin-affiliate.service"
import AffiliateStatusBadge from "../../../../components/admin/affiliates/AffiliateStatusBadge"
import AffiliateApproveModal from "../../../../components/admin/affiliates/AffiliateApproveModal"
import TableSkeleton from "../../../../components/admin/TableSkeleton"

type ModalAction = "approve" | "reject" | "edit"

export default function AffiliateDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [commissions, setCommissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalAction | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [aff, comm] = await Promise.all([
        AdminAffiliateService.getById(id),
        AdminCommissionService.getAll({ affiliateId: id, limit: 20 }).catch(() => null),
      ])
      setData(aff)
      const commList = comm ? (Array.isArray(comm) ? comm : comm?.commissions ?? []) : []
      setCommissions(commList)
    } catch { router.push("/admin/affiliates") }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])

  if (loading) return (
    <div className="space-y-5">
      <div className="h-8 bg-surface-2 rounded-xl w-40 animate-pulse" />
      <TableSkeleton rows={5} cols={4} />
    </div>
  )

  if (!data) return null

  const affiliate = { ...data.affiliate, user: data.user ?? data.affiliate?.user }
  const stats = data.stats ?? {
    totalEarnings:    data.affiliate?.totalCommission ?? 0,
    totalClicks:      data.totalClicks ?? data.affiliate?.totalClicks ?? 0,
    totalConversions: data.affiliate?.totalConversions ?? 0,
  }

  const isPending  = affiliate?.status === "PENDING"
  const isApproved = affiliate?.status === "APPROVED"
  const isRejected = affiliate?.status === "REJECTED"

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-surface-2 text-muted transition shrink-0">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold text-text">Affiliate Detail</h1>
            <p className="text-xs sm:text-sm text-muted truncate">{affiliate?.user?.name || "—"}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
          {isApproved && (
            <button onClick={() => setModal("edit")}
              className="flex items-center gap-2 border border-border text-muted px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium hover:bg-surface-2 transition">
              <Settings size={13} /> Edit Settings
            </button>
          )}
          {(isPending || isApproved) && (
            <button onClick={() => setModal("reject")}
              className="border border-red-200 dark:border-red-500/30 text-red-500 dark:text-red-400 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium hover:bg-red-50 dark:hover:bg-red-500/15 transition">
              Reject
            </button>
          )}
          {(isPending || isRejected) && (
            <button onClick={() => setModal("approve")}
              className="bg-primary text-white px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium hover:bg-primary/90 transition">
              {isRejected ? "Re-Approve" : "Approve"}
            </button>
          )}
        </div>
      </div>

      {/* Profile + Stats — stack on mobile, 3-col on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        {/* Profile card */}
        <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
              <User size={18} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-text truncate">{affiliate?.user?.name}</p>
              <AffiliateStatusBadge status={affiliate?.status} />
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted min-w-0">
              <Mail size={13} className="shrink-0" />
              <span className="truncate">{affiliate?.user?.email}</span>
            </div>
            <div className="flex items-center gap-2 text-muted">
              <Calendar size={13} className="shrink-0" />
              <span>Joined {new Date(affiliate?.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-2 text-muted">
              <DollarSign size={13} className="shrink-0" />
              <span>
                {affiliate?.commissionRate <= 1
                  ? (affiliate.commissionRate * 100).toFixed(1)
                  : affiliate?.commissionRate}% ({affiliate?.commissionType})
              </span>
            </div>
          </div>
        </div>

        {/* Stat cards */}
        {[
          { label: "Total Earnings",  value: `₹${Number(stats?.totalEarnings ?? 0).toFixed(2)}`,  icon: <TrendingUp size={18} className="text-green-600 dark:text-green-400" />,  bg: "bg-green-50 dark:bg-green-500/15" },
          { label: "Total Clicks",    value: stats?.totalClicks ?? 0,                               icon: <TrendingUp size={18} className="text-blue-600 dark:text-blue-400" />,   bg: "bg-blue-50 dark:bg-blue-500/15" },
          { label: "Conversions",     value: stats?.totalConversions ?? 0,                          icon: <TrendingUp size={18} className="text-purple-600 dark:text-purple-400" />, bg: "bg-purple-50 dark:bg-purple-500/15" },
        ].map(stat => (
          <div key={stat.label} className="bg-surface border border-border rounded-2xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
            <div className={`p-2.5 sm:p-3 rounded-xl ${stat.bg} shrink-0`}>{stat.icon}</div>
            <div>
              <p className="text-xs sm:text-sm text-muted">{stat.label}</p>
              <p className="text-xl sm:text-2xl font-bold text-text">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Application message + Admin note */}
      {(affiliate?.applicationMessage || affiliate?.adminNote) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          {affiliate?.applicationMessage && (
            <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 space-y-2">
              <div className="flex items-center gap-2 text-muted">
                <MessageSquare size={14} className="text-primary shrink-0" />
                <span className="text-sm font-semibold">Applicant's Message</span>
              </div>
              <p className="text-sm text-muted leading-relaxed whitespace-pre-wrap">{affiliate.applicationMessage}</p>
            </div>
          )}
          {affiliate?.adminNote && (
            <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 space-y-2">
              <div className="flex items-center gap-2 text-muted">
                <ShieldCheck size={14} className="text-blue-500 dark:text-blue-400 shrink-0" />
                <span className="text-sm font-semibold">Admin Note</span>
              </div>
              <p className="text-sm text-muted leading-relaxed whitespace-pre-wrap">{affiliate.adminNote}</p>
            </div>
          )}
        </div>
      )}

      {/* Commission history */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-text">Commission History</h3>
        </div>

        {/* Desktop */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2">
              <tr className="text-muted text-left">
                <th className="p-4 font-medium">Order ID</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((c: any) => (
                <tr key={c.id} className="border-t border-border hover:bg-surface-2/50">
                  <td className="p-4 font-mono text-xs text-muted">#{c.orderId?.slice(-8) ?? c.id.slice(-8)}</td>
                  <td className="p-4 font-semibold text-text">₹{c.amount?.toFixed(2)}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      c.status === "PAID"     ? "bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400" :
                      c.status === "APPROVED" ? "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400"   :
                                                "bg-yellow-50 dark:bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
                    }`}>{c.status}</span>
                  </td>
                  <td className="p-4 text-muted text-xs">{new Date(c.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {!commissions.length && (
                <tr><td colSpan={4} className="py-10 text-center text-faint">No commissions yet</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="sm:hidden divide-y divide-border">
          {commissions.map((c: any) => (
            <div key={c.id} className="p-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-muted">#{c.orderId?.slice(-8) ?? c.id.slice(-8)}</p>
                <p className="text-xs text-faint mt-0.5">{new Date(c.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  c.status === "PAID"     ? "bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400" :
                  c.status === "APPROVED" ? "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400"   :
                                            "bg-yellow-50 dark:bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
                }`}>{c.status}</span>
                <span className="font-bold text-text text-sm">₹{c.amount?.toFixed(2)}</span>
              </div>
            </div>
          ))}
          {!commissions.length && (
            <div className="py-10 text-center text-faint text-sm">No commissions yet</div>
          )}
        </div>
      </div>

      {modal && affiliate?.user && (
        <AffiliateApproveModal affiliate={affiliate} action={modal}
          onClose={() => setModal(null)} onSuccess={() => { setModal(null); load() }} />
      )}
    </div>
  )
}
