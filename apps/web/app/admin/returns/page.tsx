"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Camera } from "lucide-react"
import AdminPageHeader from "../../../components/admin/AdminPageHeader"
import TableSkeleton from "../../../components/admin/TableSkeleton"
import { AdminReturnService, type AdminReturnListRow } from "../../../lib/services/admin-return.service"
import { RETURN_STATUS_LABEL, RETURN_STATUS_CLASS, type ReturnStatus } from "../../../lib/services/return.service"

const TABS: Array<{ label: string; status?: ReturnStatus }> = [
  { label: "To review", status: "PENDING" },
  { label: "Awaiting pickup", status: "APPROVED" },
  { label: "In transit", status: "PICKED_UP" },
  { label: "Refund pending", status: "RECEIVED" },
  { label: "Refunded", status: "REFUNDED" },
  { label: "All" },
]

const money = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`

export default function AdminReturnsPage() {
  const [tab, setTab] = useState(0)
  const [rows, setRows] = useState<AdminReturnListRow[]>([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    AdminReturnService.list({ status: TABS[tab]!.status, page, limit: 20 })
      .then((res) => { setRows(res.returns); setPages(res.pages || 1); setTotal(res.total) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [tab, page])

  return (
    <div className="space-y-4 sm:space-y-5">
      <AdminPageHeader title="Returns" subtitle={total ? `${total} ${TABS[tab]!.label.toLowerCase()}` : undefined} />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t, i) => (
          <button
            key={t.label}
            onClick={() => { setTab(i); setPage(1) }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition ${
              i === tab ? "bg-primary text-white border-primary" : "border-border text-muted hover:bg-surface-2"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : rows.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-10 text-center text-sm text-faint">No returns here.</div>
      ) : (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden divide-y divide-border">
          {rows.map((r) => (
            <Link
              key={r.id}
              href={r.kind === "ITEM" ? `/admin/returns/${r.id}` : `/admin/orders/${r.orderId}`}
              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-4 hover:bg-surface-2/50 transition"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-text">Order #{r.orderId.slice(-8).toUpperCase()}</p>
                  {r.kind === "LEGACY" && (
                    <span className="text-[10px] uppercase font-bold tracking-wide text-muted bg-surface-2 px-1.5 py-0.5 rounded">Whole order</span>
                  )}
                  {r.hasEvidence && <Camera size={13} className="text-faint" />}
                </div>
                <p className="text-xs text-muted truncate">
                  {r.customer.name} · {r.reason}{r.units ? ` · ${r.units} unit${r.units === 1 ? "" : "s"}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted">
                <span>{r.order.paymentMethod === "COD" ? "COD" : r.order.paymentPlan === "PARTIAL" ? "Deposit" : "Online"}</span>
                {r.refundAmount != null && <span className="font-medium text-text">{money(r.refundAmount)}</span>}
                <span>{new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                <span className={`px-2.5 py-1 rounded-full font-semibold ${RETURN_STATUS_CLASS[r.status]}`}>
                  {RETURN_STATUS_LABEL[r.status]}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs sm:text-sm text-muted">Page {page} of {pages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="w-8 h-8 rounded-lg border border-border text-muted hover:bg-surface-2 disabled:opacity-40">‹</button>
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}
              className="w-8 h-8 rounded-lg border border-border text-muted hover:bg-surface-2 disabled:opacity-40">›</button>
          </div>
        </div>
      )}
    </div>
  )
}
