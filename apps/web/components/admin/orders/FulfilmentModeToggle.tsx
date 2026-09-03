"use client"

import { useState } from "react"
import { Truck, Home } from "lucide-react"
import { AdminOrderService, type OrderStatus } from "../../../lib/services/admin-order.service"
import { friendlyError } from "../../../lib/errorMessages"
import { toast } from "sonner"

interface Props {
  orderId: string
  manual: boolean
  currentStatus?: OrderStatus
  onSuccess: () => void
}

/**
 * Route this order by hand instead of Delhivery.
 *
 * Only offered before dispatch: past that the goods have already travelled, and the
 * server refuses it anyway. A local order is skipped by the auto-ship sweeper, so it is
 * never handed to the courier, and the admin walks it through the normal status sequence.
 */
const SWITCHABLE_STATUSES: OrderStatus[] = ["PENDING", "CONFIRMED", "PROCESSING"]

export default function FulfilmentModeToggle({ orderId, manual, currentStatus, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)

  if (currentStatus && !SWITCHABLE_STATUSES.includes(currentStatus)) return null

  const toggle = async () => {
    const message = manual
      ? "Put this order back on Delhivery? Auto-ship will pick it up again."
      : "Deliver this order locally?\n\nIt will be skipped by auto-ship, so no Delhivery waybill is created, and you move its status by hand."
    if (!confirm(message)) return

    setLoading(true)
    try {
      await AdminOrderService.setFulfilmentMode(orderId, !manual)
      toast.success(manual ? "Back on Delhivery" : "Set to local delivery")
      onSuccess()
    } catch (err) {
      toast.error(friendlyError(err, "Couldn't change the fulfilment mode"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm font-medium text-muted hover:border-primary hover:text-primary transition disabled:opacity-50"
    >
      {manual ? <Truck size={14} /> : <Home size={14} />}
      {manual ? "Use Delhivery" : "Deliver locally"}
    </button>
  )
}
