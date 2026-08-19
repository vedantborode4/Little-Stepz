"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Bell, ShoppingCart, Wallet, CheckCheck, Package, CreditCard, Users, Tag,
} from "lucide-react"
import { toast } from "sonner"
import {
  AdminNotificationService,
  type AdminNotification,
  type NotificationCategory,
} from "../../../lib/services/admin-notification.service"
import TableSkeleton from "../TableSkeleton"

const CATEGORY_ICON: Record<NotificationCategory, typeof Bell> = {
  ORDER: Package,
  PAYMENT: CreditCard,
  AFFILIATE: Users,
  MARKETING: Tag,
  SYSTEM: Bell,
}

function iconFor(n: AdminNotification) {
  if (n.type === "ADMIN_NEW_ORDER") return ShoppingCart
  if (n.type === "ADMIN_WITHDRAWAL_REQUEST") return Wallet
  return CATEGORY_ICON[n.category] ?? Bell
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.round(diff / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

export default function AdminInbox() {
  const [items, setItems] = useState<AdminNotification[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const load = useCallback(async (p: number) => {
    p === 1 ? setLoading(true) : setLoadingMore(true)
    try {
      const res = await AdminNotificationService.feed({ page: p, limit: 20 })
      setItems((prev) => (p === 1 ? res.items : [...prev, ...res.items]))
      setTotalPages(res.pagination.totalPages)
      setUnread(res.unreadCount)
      setPage(p)
    } catch {
      if (p === 1) setItems([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => { load(1) }, [load])

  // Poll the first page. This fetched once on mount, so "New order received" only
  // ever appeared if the admin happened to reload — the notification worked, the
  // surfacing didn't. Only refresh page 1, so paging back through history isn't
  // yanked out from under the reader.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible" && page === 1) load(1)
    }, 60_000)
    return () => clearInterval(id)
  }, [load, page])

  const markRead = async (n: AdminNotification) => {
    if (n.readAt) return
    setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, readAt: new Date().toISOString() } : i)))
    setUnread((u) => Math.max(0, u - 1))
    try { await AdminNotificationService.markRead(n.id) } catch { /* re-sync on next load */ }
  }

  const markAll = async () => {
    setItems((prev) => prev.map((i) => (i.readAt ? i : { ...i, readAt: new Date().toISOString() })))
    setUnread(0)
    try {
      await AdminNotificationService.markAllRead()
      toast.success("All marked as read")
    } catch {
      toast.error("Failed to mark all read")
      load(1)
    }
  }

  if (loading) return <TableSkeleton rows={6} cols={1} />

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted">
          {unread > 0 ? `${unread} unread` : "You're all caught up"}
        </p>
        {unread > 0 && (
          <button
            onClick={markAll}
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <CheckCheck size={15} /> Mark all read
          </button>
        )}
      </div>

      <div className="bg-surface border border-border rounded-2xl overflow-hidden divide-y divide-border">
        {items.length === 0 && (
          <div className="py-16 text-center text-faint text-sm">No notifications yet</div>
        )}
        {items.map((n) => {
          const Icon = iconFor(n)
          const unreadRow = !n.readAt
          return (
            <button
              key={n.id}
              onClick={() => markRead(n)}
              className={`w-full text-left flex gap-3 px-4 py-3.5 transition hover:bg-surface-2/50 ${
                unreadRow ? "bg-primary/5" : ""
              }`}
            >
              <div className="w-9 h-9 rounded-full bg-surface-2 flex items-center justify-center shrink-0">
                <Icon size={17} className="text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <span className={`text-sm flex-1 ${unreadRow ? "font-semibold text-text" : "font-medium text-text"}`}>
                    {n.title}
                  </span>
                  {unreadRow && <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />}
                </div>
                <p className="text-sm text-muted mt-0.5">{n.body}</p>
                <p className="text-xs text-faint mt-1">{timeAgo(n.createdAt)}</p>
              </div>
            </button>
          )
        })}
      </div>

      {page < totalPages && (
        <div className="flex justify-center mt-4">
          <button
            onClick={() => load(page + 1)}
            disabled={loadingMore}
            className="px-4 py-2 rounded-xl border border-border text-sm text-muted hover:bg-surface-2 disabled:opacity-60"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  )
}
