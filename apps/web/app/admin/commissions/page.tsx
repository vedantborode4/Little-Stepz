"use client"

import { useEffect, useState, useRef } from "react"
import { scrollToTopOf } from "../../../lib/utils/scroll"
import { AdminCommissionService, type AdminCommission } from "../../../lib/services/admin-affiliate.service"
import AdminPageHeader from "../../../components/admin/AdminPageHeader"
import TableSkeleton from "../../../components/admin/TableSkeleton"
import AdminModal from "../../../components/admin/AdminModal"
import { toast } from "sonner"

const TABS = ["All", "PENDING", "APPROVED", "PAID", "CANCELLED"]

const statusBadge = (s: string) => {
  const map: Record<string, string> = { PENDING: "bg-yellow-50 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-300", APPROVED: "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300", PAID: "bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-300", CANCELLED: "bg-red-50 dark:bg-red-500/15 text-red-500 dark:text-red-400" }
  return <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${map[s] ?? "bg-surface-2 text-muted"}`}>{s}</span>
}

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

  // Paging swaps the rows underneath a viewport that stays where it was, so the list
  // looks unchanged until you scroll back up yourself. Put it on the new rows instead.
  const listRef = useRef<HTMLDivElement>(null)

  const goToPage = (next: number) => {
    const clamped = Math.min(Math.max(1, next), pagination.pages)
    if (clamped === page) return
    scrollToTopOf(listRef.current)
    setPage(clamped)
  }

  const fetch = async () => {
    setLoading(true)
    try {
      const res = await AdminCommissionService.getAll({ status: tab === "All" ? undefined : tab, page, limit: 15 })
      setCommissions(res.commissions); setSummary(res.summary)
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
    try { await AdminCommissionService.approve(id); toast.success("Commission approved"); fetch() }
    catch (e: any) { toast.error(e?.response?.data?.message || "Failed") }
    finally { setActing(false) }
  }

  const handlePay = async () => {
    if (!payModal) return
    setActing(true)
    try {
      await AdminCommissionService.markPaid(payModal.id, transactionRef || undefined, note || undefined)
      toast.success("Commission marked as paid"); setPayModal(null); setTransactionRef(""); setNote(""); fetch()
    } catch (e: any) { toast.error(e?.response?.data?.message || "Failed") }
    finally { setActing(false) }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <AdminPageHeader title="Commissions"
        subtitle={summary ? `₹${summary.totalAmount.toLocaleString("en-IN")} total · ${summary.totalCount} commissions` : undefined} />

      <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-xl w-full sm:w-fit overflow-x-auto scrollbar-none">
        {TABS.map(t => (
          <button key={t} onClick={() => { setTab(t); setPage(1) }}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition whitespace-nowrap ${tab === t ? "bg-surface text-text shadow-sm" : "text-muted hover:text-muted"}`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? <TableSkeleton rows={10} cols={7} /> : (
        <div ref={listRef} className="bg-surface border border-border rounded-2xl overflow-hidden scroll-mt-20">

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 border-b border-border">
                <tr className="text-muted text-left">
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
                  <tr key={c.id} className="border-t border-border hover:bg-surface-2/50 transition">
                    <td className="p-4"><p className="font-medium text-text">{c.affiliate.user.name}</p><p className="text-xs text-faint font-mono">{c.affiliate.referralCode}</p></td>
                    <td className="p-4 text-muted">₹{c.order.total.toLocaleString()}</td>
                    <td className="p-4 font-semibold text-text">₹{c.amount.toLocaleString()}</td>
                    <td className="p-4 text-muted">{(c.affiliate.commissionRate * 100).toFixed(0)}%</td>
                    <td className="p-4">{statusBadge(c.status)}</td>
                    <td className="p-4 text-faint text-xs">{new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        {c.status === "PENDING" && <button onClick={() => handleApprove(c.id)} disabled={acting} className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600 disabled:opacity-60">Approve</button>}
                        {c.status === "APPROVED" && <button onClick={() => setPayModal(c)} className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600">Mark Paid</button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {!commissions.length && (<tr><td colSpan={7} className="py-16 text-center text-faint">No commissions found</td></tr>)}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-border">
            {commissions.map(c => (
              <div key={c.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-text text-sm">{c.affiliate.user.name}</p>
                    <p className="text-xs text-faint font-mono">{c.affiliate.referralCode}</p>
                  </div>
                  {statusBadge(c.status)}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted">Order: ₹{c.order.total.toLocaleString()}</span>
                  <span className="font-bold text-text">Commission: ₹{c.amount.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-faint">{new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                  <div className="flex gap-2">
                    {c.status === "PENDING" && <button onClick={() => handleApprove(c.id)} disabled={acting} className="px-3 py-1 bg-blue-500 text-white rounded-lg text-xs font-medium">Approve</button>}
                    {c.status === "APPROVED" && <button onClick={() => setPayModal(c)} className="px-3 py-1 bg-green-500 text-white rounded-lg text-xs font-medium">Mark Paid</button>}
                  </div>
                </div>
              </div>
            ))}
            {!commissions.length && (<div className="py-16 text-center text-faint text-sm">No commissions found</div>)}
          </div>

          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-xs sm:text-sm text-muted">Page {page} of {pagination.pages} · {pagination.total} total</p>
              <div className="flex gap-2">
                <button onClick={() => goToPage(page - 1)} disabled={page === 1} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border disabled:opacity-40 hover:bg-surface-2">‹</button>
                <button onClick={() => goToPage(page + 1)} disabled={page === pagination.pages} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border disabled:opacity-40 hover:bg-surface-2">›</button>
              </div>
            </div>
          )}
        </div>
      )}

      {payModal && (
        <AdminModal title="Mark Commission as Paid" onClose={() => setPayModal(null)} width="max-w-sm">
          <div className="space-y-4">
            <div className="bg-surface-2 rounded-xl p-3 text-sm">
              <p className="text-muted">Amount to mark paid</p>
              <p className="text-xl font-bold text-text">₹{payModal.amount.toLocaleString()}</p>
              <p className="text-xs text-faint">To: {payModal.affiliate.user.name}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted">Transaction Reference (optional)</label>
              <input value={transactionRef} onChange={e => setTransactionRef(e.target.value)} placeholder="UTR/Reference number" className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"/>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted">Note (optional)</label>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Paid via UPI" className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"/>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPayModal(null)} className="flex-1 py-2.5 border border-border rounded-xl text-sm text-muted">Cancel</button>
              <button onClick={handlePay} disabled={acting} className="flex-1 py-2.5 bg-green-500 text-white rounded-xl text-sm font-medium disabled:opacity-60 hover:bg-green-600">
                {acting ? "Processing…" : "Confirm Paid"}
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  )
}
