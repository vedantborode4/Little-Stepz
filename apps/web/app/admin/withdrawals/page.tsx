"use client"

import { useEffect, useState } from "react"
import { AdminWithdrawalService, type AdminWithdrawal } from "../../../lib/services/admin-affiliate.service"
import AdminPageHeader from "../../../components/admin/AdminPageHeader"
import TableSkeleton from "../../../components/admin/TableSkeleton"
import AdminModal from "../../../components/admin/AdminModal"
import { toast } from "sonner"

const TABS = ["All", "PENDING", "PROCESSING", "PAID", "REJECTED"]

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([])
  const [pagination, setPagination] = useState({ pages: 1, total: 0 })
  const [tab, setTab] = useState("All")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<AdminWithdrawal | null>(null)
  const [decision, setDecision] = useState<"PAID" | "REJECTED">("PAID")
  const [transactionRef, setTransactionRef] = useState("")
  const [adminNote, setAdminNote] = useState("")
  const [acting, setActing] = useState(false)

  const fetch = async () => {
    setLoading(true)
    try {
      const res = await AdminWithdrawalService.getAll({ status: tab === "All" ? undefined : tab, page, limit: 15 })
      setWithdrawals(res.withdrawals)
      setPagination({ pages: res.pagination.pages, total: res.pagination.total })
    } catch (e: any) {
      if (e?.response?.status !== 404) toast.error("Failed to load withdrawals")
      setWithdrawals([])
    } finally { setLoading(false) }
  }

  useEffect(() => { fetch() }, [tab, page])

  const handleProcess = async () => {
    if (!modal) return
    setActing(true)
    try {
      await AdminWithdrawalService.process(modal.id, {
        status: decision,
        transactionRef: transactionRef || undefined,
        adminNote: adminNote || undefined,
      })
      toast.success(decision === "PAID" ? "Withdrawal marked as paid" : "Withdrawal rejected")
      setModal(null); setTransactionRef(""); setAdminNote("")
      fetch()
    } catch (e: any) { toast.error(e?.response?.data?.message || "Failed to process") }
    finally { setActing(false) }
  }

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      PENDING: "bg-yellow-50 text-yellow-700",
      PROCESSING: "bg-blue-50 text-blue-700",
      PAID: "bg-green-50 text-green-700",
      REJECTED: "bg-red-50 text-red-500",
    }
    return <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${map[s] ?? "bg-gray-100 text-gray-600"}`}>{s}</span>
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader title="Withdrawals" subtitle={`${pagination.total} total`} />

      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => { setTab(t); setPage(1) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? <TableSkeleton rows={8} cols={6} /> : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-gray-500 text-left">
                <th className="p-4 font-medium">Affiliate</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Payout Method</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Requested</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map(w => (
                <tr key={w.id} className="border-t border-gray-100 hover:bg-gray-50/50 transition">
                  <td className="p-4">
                    <p className="font-medium text-gray-900">{w.affiliate.user.name}</p>
                    <p className="text-xs text-gray-400">{w.affiliate.user.email}</p>
                  </td>
                  <td className="p-4 font-semibold text-gray-900">₹{w.amount.toLocaleString()}</td>
                  <td className="p-4 text-gray-600 text-xs">
                    {typeof w.payoutDetails === "object" && w.payoutDetails
                      ? Object.entries(w.payoutDetails).map(([k, v]) => `${k}: ${v}`).join(" · ")
                      : "—"}
                  </td>
                  <td className="p-4">{statusBadge(w.status)}</td>
                  <td className="p-4 text-gray-400 text-xs">{new Date(w.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td className="p-4">
                    <div className="flex justify-end">
                      {(w.status === "PENDING" || w.status === "PROCESSING") && (
                        <button onClick={() => setModal(w)}
                          className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90">
                          Process
                        </button>
                      )}
                      {w.transactionRef && (
                        <span className="text-xs text-gray-400 font-mono">{w.transactionRef}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!withdrawals.length && (
                <tr><td colSpan={6} className="py-16 text-center text-gray-400">No withdrawals found</td></tr>
              )}
            </tbody>
          </table>

          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-sm text-gray-500">Page {page} of {pagination.pages}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">‹</button>
                <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">›</button>
              </div>
            </div>
          )}
        </div>
      )}

      {modal && (
        <AdminModal title="Process Withdrawal" onClose={() => setModal(null)} width="max-w-md">
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm text-gray-500">Withdrawal request from</p>
              <p className="font-semibold text-gray-900">{modal.affiliate.user.name}</p>
              <p className="text-xl font-bold text-gray-900 mt-1">₹{modal.amount.toLocaleString()}</p>
            </div>

            <div className="flex gap-2">
              {(["PAID", "REJECTED"] as const).map(d => (
                <button key={d} onClick={() => setDecision(d)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition ${
                    decision === d
                      ? d === "PAID" ? "bg-green-500 text-white border-green-500" : "bg-red-500 text-white border-red-500"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}>
                  {d === "PAID" ? "✓ Mark as Paid" : "✗ Reject"}
                </button>
              ))}
            </div>

            {decision === "PAID" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Transaction Reference</label>
                <input value={transactionRef} onChange={e => setTransactionRef(e.target.value)}
                  placeholder="UTR / Transaction ID"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Admin Note (optional)</label>
              <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} rows={2}
                placeholder={decision === "REJECTED" ? "Reason for rejection..." : "Any notes..."}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Cancel</button>
              <button onClick={handleProcess} disabled={acting}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-60 ${decision === "PAID" ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"}`}>
                {acting ? "Processing…" : "Confirm"}
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  )
}
