"use client"

import { useEffect, useState } from "react"
import { Users, Send } from "lucide-react"
import {
  AdminNotificationService,
  type BroadcastRecord,
} from "../../../lib/services/admin-notification.service"
import TableSkeleton from "../TableSkeleton"

export default function BroadcastHistory() {
  const [items, setItems] = useState<BroadcastRecord[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    AdminNotificationService.broadcastHistory({ page, limit: 15 })
      .then((res) => {
        if (!alive) return
        setItems(res.items)
        setTotalPages(res.pagination.totalPages)
      })
      .catch(() => { if (alive) setItems([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [page])

  if (loading) return <TableSkeleton rows={6} cols={1} />

  return (
    <div className="max-w-2xl space-y-3">
      <div className="bg-surface border border-border rounded-2xl overflow-hidden divide-y divide-border">
        {items.length === 0 && (
          <div className="py-16 text-center text-faint text-sm">Nothing sent yet</div>
        )}
        {items.map((b) => (
          <div key={b.id} className="px-4 py-3.5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-surface-2 flex items-center justify-center shrink-0">
                <Send size={16} className="text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text">{b.title}</p>
                <p className="text-sm text-muted mt-0.5 line-clamp-2">{b.body}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-faint">
                  <span className="inline-flex items-center gap-1">
                    <Users size={12} /> {b.recipientCount} recipient{b.recipientCount === 1 ? "" : "s"}
                  </span>
                  {b.targetLabel && <span>· {b.targetLabel}</span>}
                  <span>· {new Date(b.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                  {b.adminName && <span>· by {b.adminName}</span>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border disabled:opacity-40 hover:bg-surface-2">‹</button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border disabled:opacity-40 hover:bg-surface-2">›</button>
          </div>
        </div>
      )}
    </div>
  )
}
