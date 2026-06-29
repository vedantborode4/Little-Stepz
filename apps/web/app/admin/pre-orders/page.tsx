"use client"

import { useEffect, useState } from "react"
import { AdminPreOrderService, type AdminPreOrder } from "../../../lib/services/admin-preorder.service"
import PreOrdersTable from "../../../components/admin/pre-orders/PreOrdersTable"
import AdminPageHeader from "../../../components/admin/AdminPageHeader"
import TableSkeleton from "../../../components/admin/TableSkeleton"

const STATUSES = [
  "", "PENDING_BOOKING", "BOOKED", "AWAITING_BALANCE", "COMPLETED", "EXPIRED", "CANCELLED", "REFUNDED",
]

export default function AdminPreOrdersPage() {
  const [preOrders, setPreOrders] = useState<AdminPreOrder[]>([])
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchPreOrders = async () => {
    setLoading(true)
    try {
      const res = await AdminPreOrderService.list({ page, limit: 15, status: status || undefined })
      setPreOrders(res.preOrders ?? [])
      setTotalPages(res.pages ?? 1)
      setTotal(res.total ?? 0)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchPreOrders() }, [status, page])

  return (
    <div className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Pre-Orders"
        subtitle={total ? `${total} total pre-orders` : undefined}
        action={
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s === "" ? "All statuses" : s.replace(/_/g, " ")}</option>
            ))}
          </select>
        }
      />

      {loading ? (
        <TableSkeleton rows={10} cols={5} />
      ) : (
        <>
          <PreOrdersTable data={preOrders} refresh={fetchPreOrders} />

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs sm:text-sm text-gray-500">Page {page} of {totalPages}</p>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 text-lg">‹</button>
                <span className="text-sm text-gray-600 font-medium px-2">{page}/{totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 text-lg">›</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
