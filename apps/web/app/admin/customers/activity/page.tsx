"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ShieldAlert } from "lucide-react"
import {
  AdminCustomerService,
  type CartActivityEvent,
} from "../../../../lib/services/admin-customer.service"
import AdminPageHeader from "../../../../components/admin/AdminPageHeader"
import TableSkeleton from "../../../../components/admin/TableSkeleton"

const dt = (d: string) =>
  new Date(d).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  })

export default function AdminCartActivityPage() {
  const [events, setEvents] = useState<CartActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await AdminCustomerService.cartActivity({ page, limit: 50 })
      setEvents(res.events ?? [])
      setTotalPages(res.pagination?.totalPages ?? 1)
      setTotal(res.pagination?.total ?? 0)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  return (
    <div className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Cart Activity"
        subtitle={total ? `${total} add-to-cart events` : undefined}
      />

      {loading ? (
        <TableSkeleton rows={12} cols={5} />
      ) : events.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-10 text-center">
          <p className="text-sm text-muted">No add-to-cart events recorded yet.</p>
          <p className="text-xs text-faint mt-1">Events are recorded from the moment this feature went live.</p>
        </div>
      ) : (
        <>
          <div className="bg-surface border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead className="bg-surface-2 border-b border-border">
                  <tr className="text-left text-xs font-semibold text-muted uppercase tracking-wide">
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3">IP address</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id} className="border-b border-border last:border-0 hover:bg-surface-2 transition">
                      <td className="px-4 py-3 text-muted whitespace-nowrap">{dt(e.createdAt)}</td>
                      <td className="px-4 py-3">
                        {e.user ? (
                          <Link href={`/admin/customers/${e.user.id}`} className="text-primary hover:underline">
                            {e.user.name}
                          </Link>
                        ) : (
                          <span className="text-faint">Guest{e.sessionId ? ` · ${e.sessionId.slice(0, 8)}` : ""}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text">{e.product.name}</td>
                      <td className="px-4 py-3 text-right text-muted">{e.quantity}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">{e.ip ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs sm:text-sm text-muted">Page {page} of {totalPages}</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted hover:bg-surface-2 disabled:opacity-40 text-lg"
                >‹</button>
                <span className="text-sm text-muted font-medium px-2">{page}/{totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted hover:bg-surface-2 disabled:opacity-40 text-lg"
                >›</button>
              </div>
            </div>
          )}
        </>
      )}

      <p className="flex items-start gap-1.5 text-[11px] text-faint">
        <ShieldAlert size={12} className="mt-0.5 shrink-0" />
        IP addresses are personal data under the DPDP Act. Use them for fraud and abuse
        investigation only, and keep access limited to staff who need it.
      </p>
    </div>
  )
}
