"use client"

import { useEffect, useState } from "react"
import { AdminCommissionService, type AdminCommission, type CommissionStatus } from "../../../lib/services/admin-affiliate.service"
import AdminPageHeader from "../../../components/admin/AdminPageHeader"
import TableSkeleton from "../../../components/admin/TableSkeleton"
import AdminModal from "../../../components/admin/AdminModal"
import { toast } from "sonner"

const TABS = ["All", "PENDING", "APPROVED", "PAID", "CANCELLED"]

export default function AdminCommissionsPage() {
  const [commissions, setCommissions] = useState<AdminCommission[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [pagination, setPagination] = useState({ pages: 1, total: 0 })
  const [tab, setTab] = useState("All")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [payModal, setPayModal] = useState<AdminCommission | null>(null)
  const [transactionRef, setTransactionRef] = useState("")
  const [note, setNote] = useState("")
  const [acting, setActing] = useState(false)

  const fetch = async () => {
    setLoading(true)
    try {
      const res = await AdminCommissionService.getAll({
        status: tab === "All" ? undefined : tab,
        page, limit: 15,
      })
      setCommissions(res.commissions)
      setSummary(res.summary)
      setPagination({ pages: res.pagination.pages, total: res.pagination.total })
    } catch (e: any) {
      if (e?.response?.status !== 404) toast.error("Failed to load commissions")
      setCommissions([])
    } finally { setLoading(false) }
  }

  useEffect(() => { fetch() }, [tab, page])

  const handleApprove = async (id: string) => {
    if (!confirm("Approve this commission?")) return
    setActing(true)
    try {
      await AdminCommissionService.approve(id)
      toast.success("Commission approved")
      fetch()
    } catch (e: any) { toast.error(e?.response?.data?.message || "Failed") }
    finally { setActing(false) }
  }

  const handlePay = async () => {
    if (!payModal) return
    setActing(true)
    try {
      await AdminCommissionService.markPaid(payModal.id, transactionRef || undefined, note || undefined)
      toast.success("Commission marked as paid")
      setPayModal(null)
      setTransactionRef(""); setNote("")
      fetch()
    } catch (e: any) { toast.error(e?.response?.data?.message || "Failed") }
    finally { setActing(false) }
  }

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      PENDING: "bg-yellow-50 text-yellow-700",
      APPROVED: "bg-blue-50 text-blue-700",
      PAID: "bg-green-50 text-green-700",
      CANCELLED: "bg-red-50 text-red-500",
    }
    return <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${map[s] ?? "bg-gray-100 text-gray-600"}`}>{s}</span>
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader title="Commissions" subtitle={summary ? `₹${summary.totalAmount.toLocaleString("en-IN")} total · ${summary.totalCount} commissions` : undefined} />

      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => { setTab(t); setPage(1) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? <TableSkeleton rows={10} cols={7} /> : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-gray-500 text-left">
                <th className="p-4 font-medium">Affiliate</th>
                <th className="p-4 font-medium">Order Total</th>
                <th className="p-4 font-medium">Commission</th>
                <th className="p-4 font-medium">Rate</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map(c => (
                <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50/50 transition">
                  <td className="p-4">
                    <p className="font-medium text-gray-900">{c.affiliate.user.name}</p>
                    <p className="text-xs text-gray-400 font-mono">{c.affiliate.referralCode}</p>
                  </td>
                  <td className="p-4 text-gray-700">₹{c.order.total.toLocaleString()}</td>
                  <td className="p-4 font-semibold text-gray-900">₹{c.amount.toLocaleString()}</td>
                  <td className="p-4 text-gray-500">{(c.affiliate.commissionRate * 100).toFixed(0)}%</td>
                  <td className="p-4">{statusBadge(c.status)}</td>
                  <td className="p-4 text-gray-400 text-xs">{new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      {c.status === "PENDING" && (
                        <button onClick={() => handleApprove(c.id)} disabled={acting}
                          className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600 disabled:opacity-60">
                          Approve
                        </button>
                      )}
                      {c.status === "APPROVED" && (
                        <button onClick={() => setPayModal(c)}
                          className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600">
                          Mark Paid
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!commissions.length && (
                <tr><td colSpan={7} className="py-16 text-center text-gray-400">No commissions found</td></tr>
              )}
            </tbody>
          </table>

          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-sm text-gray-500">Page {page} of {pagination.pages} · {pagination.total} total</p>
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

      {payModal && (
        <AdminModal title="Mark Commission as Paid" onClose={() => setPayModal(null)} width="max-w-sm">
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-3 text-sm">
              <p className="text-gray-500">Amount to mark paid</p>
              <p className="text-xl font-bold text-gray-900">₹{payModal.amount.toLocaleString()}</p>
              <p className="text-xs text-gray-400">To: {payModal.affiliate.user.name}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Transaction Reference (optional)</label>
              <input value={transactionRef} onChange={e => setTransactionRef(e.target.value)}
                placeholder="UTR/Reference number"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Note (optional)</label>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Paid via UPI"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPayModal(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Cancel</button>
              <button onClick={handlePay} disabled={acting}
                className="flex-1 py-2.5 bg-green-500 text-white rounded-xl text-sm font-medium disabled:opacity-60 hover:bg-green-600">
                {acting ? "Processing…" : "Confirm Paid"}
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  )
}
