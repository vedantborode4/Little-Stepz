"use client"

import { useState } from "react"
import type { SalesListQuery, SalesOrderListItemDto } from "@repo/crm-schema"
import { Skeleton } from "@/components/ui/Display"
import Modal from "@/components/ui/Modal"
import { SearchInput } from "@/components/ui/Toolbar"
import { formatDate, formatMoney } from "@/lib/format"
import { useOrders } from "./api"
import { OrderStatusBadge } from "./shared"

interface Props {
  readyFor: NonNullable<SalesListQuery["readyFor"]>
  title: string
  hint: string
  /** Shown when no order is ready at all (before any search). */
  empty: string
  onPick: (order: SalesOrderListItemDto) => void
  onClose: () => void
}

/** Find an order a shipment or a return can start from. Only orders that qualify are listed. */
export default function OrderPicker({ readyFor, title, hint, empty, onPick, onClose }: Props) {
  const [q, setQ] = useState("")
  const { data, isLoading } = useOrders({ readyFor, q: q || undefined, limit: 20 })
  const orders = data?.items ?? []

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-muted">{hint}</p>
        <SearchInput value={q} onChange={setQ} placeholder="Order number or customer" />
        {isLoading ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : orders.length === 0 ? (
          <p className="text-sm text-muted text-center py-6">{q ? `No ready order matches “${q}”.` : empty}</p>
        ) : (
          <ul className="divide-y divide-border -mx-2">
            {orders.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => onPick(o)}
                  className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-left hover:bg-surface-2 transition"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate">
                      <span className="font-mono text-xs text-primary">{o.code}</span> · {o.customer?.name ?? "Walk-in"}
                    </span>
                    <span className="block text-xs text-faint">
                      {formatDate(o.orderDate)} · {o.units} {o.units === 1 ? "item" : "items"} · {formatMoney(o.grandTotal)}
                    </span>
                  </span>
                  <OrderStatusBadge status={o.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
