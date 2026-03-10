"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, User, Mail, Calendar, DollarSign, TrendingUp, Settings } from "lucide-react"
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
      <div className="h-8 bg-gray-100 rounded-xl w-40 animate-pulse" />
      <TableSkeleton rows={5} cols={4} />
    </div>
  )

  if (!data) return null

  // Backend returns { affiliate: {...}, user: {...}, recentCommissions, ... }
  // user is TOP-LEVEL, not nested inside affiliate.
  // AffiliateApproveModal needs affiliate.user, so we merge them here.
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Affiliate Detail</h1>
          <p className="text-sm text-gray-500">{affiliate?.user?.name || "—"}</p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Edit commission settings — only for approved affiliates */}
          {isApproved && (
            <button
              onClick={() => setModal("edit")}
              className="flex items-center gap-2 border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
            >
              <Settings size={14} />
              Edit Settings
            </button>
          )}

          {/* Reject — available for PENDING and APPROVED */}
          {(isPending || isApproved) && (
            <button
              onClick={() => setModal("reject")}
              className="border border-red-200 text-red-500 px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-50 transition"
            >
              Reject
            </button>
          )}

          {/* Approve — available for PENDING and REJECTED */}
          {(isPending || isRejected) && (
            <button
              onClick={() => setModal("approve")}
              className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 transition"
            >
              {isRejected ? "Re-Approve" : "Approve"}
            </button>
          )}
        </div>
      </div>

      {/* Profile + Stats */}
      <div className="grid grid-cols-3 gap-5">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <User size={20} className="text-primary" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{affiliate?.user?.name}</p>
              <AffiliateStatusBadge status={affiliate?.status} />
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-500">
              <Mail size={14} />
              <span>{affiliate?.user?.email}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <Calendar size={14} />
              <span>Joined {new Date(affiliate?.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <DollarSign size={14} />
              <span>
                Commission:{" "}
                {affiliate?.commissionRate <= 1
                  ? (affiliate.commissionRate * 100).toFixed(1)
                  : affiliate?.commissionRate}
                % ({affiliate?.commissionType})
              </span>
            </div>
          </div>
        </div>

        {[
          { label: "Total Earnings",  value: `₹${Number(stats?.totalEarnings ?? 0).toFixed(2)}`,  icon: <TrendingUp size={18} className="text-green-600" />,  bg: "bg-green-50" },
          { label: "Total Clicks",    value: stats?.totalClicks ?? 0,                               icon: <TrendingUp size={18} className="text-blue-600" />,   bg: "bg-blue-50" },
          { label: "Conversions",     value: stats?.totalConversions ?? 0,                          icon: <TrendingUp size={18} className="text-purple-600" />, bg: "bg-purple-50" },
        ].map(stat => (
          <div key={stat.label} className="bg-white border border-gray-200 rounded-2xl p-5 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${stat.bg}`}>{stat.icon}</div>
            <div>
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Commission history */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Commission History</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-gray-500 text-left">
              <th className="p-4 font-medium">Order ID</th>
              <th className="p-4 font-medium">Amount</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {commissions.map((c: any) => (
              <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                <td className="p-4 font-mono text-xs text-gray-600">#{c.orderId?.slice(-8) ?? c.id.slice(-8)}</td>
                <td className="p-4 font-semibold text-gray-900">₹{c.amount?.toFixed(2)}</td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    c.status === "PAID"     ? "bg-green-50 text-green-600" :
                    c.status === "APPROVED" ? "bg-blue-50 text-blue-600"   :
                                              "bg-yellow-50 text-yellow-600"
                  }`}>{c.status}</span>
                </td>
                <td className="p-4 text-gray-500">{new Date(c.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {!commissions.length && (
              <tr><td colSpan={4} className="py-10 text-center text-gray-400">No commissions yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && affiliate?.user && (
        <AffiliateApproveModal
          affiliate={affiliate}
          action={modal}
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); load() }}
        />
      )}
    </div>
  )
}