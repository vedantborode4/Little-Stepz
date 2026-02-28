"use client"

import { useEffect, useState } from "react"
import { MoreHorizontal, Filter, ArrowUpDown, UserPlus } from "lucide-react"
import {
  AdminAffiliateService,
  type AdminAffiliate,
} from "../../../lib/services/admin-affiliate.service"
import AffiliateStatusBadge from "../../../components/admin/affiliates/AffiliateStatusBadge"
import AffiliateActionMenu from "../../../components/admin/affiliates/AffiliateActionMenu"
import AffiliateApproveModal from "../../../components/admin/affiliates/AffiliateApproveModal"
import TableSkeleton from "../../../components/admin/TableSkeleton"
import AdminPageHeader from "../../../components/admin/AdminPageHeader"
import { useRouter } from "next/navigation"

export default function AdminAffiliatesPage() {
  const router = useRouter()
  const [affiliates, setAffiliates] = useState<AdminAffiliate[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string[]>([])
  const [approveTarget, setApproveTarget] = useState<AdminAffiliate | null>(null)
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchAffiliates = async () => {
    setLoading(true)
    try {
      const res = await AdminAffiliateService.getAll({
        page,
        limit: 10,
        ...(statusFilter ? { status: statusFilter } : {}),
      })
      // Backend may return: { affiliates: [] } | { data: [] } | []
      const list = Array.isArray(res) ? res : res?.affiliates ?? res?.data ?? []
      setAffiliates(list)
      setTotalPages(res?.pages ?? 1)
    } catch (e: any) {
      if (e?.response?.status !== 404) console.error(e)
      setAffiliates([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAffiliates() }, [page, statusFilter])

  const toggleSelect = (id: string) =>
    setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])

  const toggleAll = () =>
    setSelected(selected.length === affiliates.length ? [] : affiliates.map((a) => a.id))

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Affiliate"
        action={
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 text-sm text-gray-600 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50 transition">
              <ArrowUpDown size={14} />
              Sort By
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter ? "" : "PENDING")}
              className="flex items-center gap-2 text-sm text-gray-600 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50 transition"
            >
              <Filter size={14} />
              Filter
            </button>
            <button className="flex items-center gap-2 text-sm text-white bg-primary rounded-lg px-4 py-2 hover:bg-primary/90 transition font-medium">
              <UserPlus size={14} />
              Invite Affiliates
            </button>
          </div>
        }
      />

      {/* Status tabs */}
      <div className="flex gap-2">
        {["", "PENDING", "APPROVED", "REJECTED"].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1) }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              statusFilter === s
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {loading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-gray-500 text-left">
                <th className="p-4 w-10">
                  <input
                    type="checkbox"
                    checked={selected.length === affiliates.length && affiliates.length > 0}
                    onChange={toggleAll}
                    className="rounded accent-primary"
                  />
                </th>
                <th className="p-4 font-medium">Affiliates Name</th>
                <th className="p-4 font-medium">Payout Mail</th>
                <th className="p-4 font-medium">Referred By</th>
                <th className="p-4 font-medium">Method</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Payments</th>
                <th className="p-4 font-medium w-16">Action</th>
              </tr>
            </thead>
            <tbody>
              {affiliates.map((a) => (
                <tr
                  key={a.id}
                  className="border-t border-gray-100 hover:bg-gray-50/50 transition cursor-pointer"
                  onClick={() => router.push(`/admin/affiliates/${a.id}`)}
                >
                  <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.includes(a.id)}
                      onChange={() => toggleSelect(a.id)}
                      className="rounded accent-primary"
                    />
                  </td>
                  <td className="p-4 font-medium text-gray-900">{a.user?.name || "—"}</td>
                  <td className="p-4 text-gray-600">{a.user?.email || "—"}</td>
                  <td className="p-4 text-gray-600">{a.user?.name || "—"}</td>
                  <td className="p-4 text-gray-600 capitalize">
                    {a.payoutDetails?.method || "—"}
                  </td>
                  <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    <AffiliateStatusBadge status={a.status} />
                  </td>
                  <td className="p-4 font-medium text-gray-900">
                    ₹{(a.totalEarnings ?? 0).toFixed(2)}
                  </td>
                  <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    <AffiliateActionMenu
                      affiliate={a}
                      onApprove={() => setApproveTarget(a)}
                      onRefresh={fetchAffiliates}
                    />
                  </td>
                </tr>
              ))}
              {!affiliates.length && (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-gray-400">
                    No affiliates found
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-100">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
            >
              ‹
            </button>
            <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary text-white text-sm font-medium">
              {String(page).padStart(2, "0")}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>
      )}

      {approveTarget && (
        <AffiliateApproveModal
          affiliate={approveTarget}
          onClose={() => setApproveTarget(null)}
          onSuccess={() => { setApproveTarget(null); fetchAffiliates() }}
        />
      )}
    </div>
  )
}
