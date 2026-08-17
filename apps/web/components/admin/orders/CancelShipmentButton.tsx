"use client"

import { useState } from "react"
import { XCircle } from "lucide-react"
import { AdminOrderService, type OrderStatus } from "../../../lib/services/admin-order.service"
import { friendlyError } from "../../../lib/errorMessages"
import { toast } from "sonner"

interface Props {
  orderId: string
  currentStatus?: OrderStatus
  onSuccess: () => void
  refresh?: () => void
}

// A shipment exists once the order is PROCESSING; it can be cancelled until it's delivered/returned.
const CANCELLABLE_STATUSES: OrderStatus[] = ["PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY"]

export default function CancelShipmentButton({ orderId, currentStatus, onSuccess, refresh }: Props) {
  const [loading, setLoading] = useState(false)

  const cb = onSuccess ?? refresh

  if (currentStatus && !CANCELLABLE_STATUSES.includes(currentStatus)) return null

  const cancel = async () => {
    if (!confirm("Cancel the shipment for this order? The waybill will be cancelled with Delhivery.")) return
    setLoading(true)
    try {
      await AdminOrderService.cancelShipment(orderId)
      toast.success("Shipment cancelled")
      cb?.()
    } catch (e: any) {
      toast.error(friendlyError(e, "Failed to cancel shipment"), { duration: 10000 })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={cancel}
      disabled={loading}
      className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-700 transition disabled:opacity-60"
    >
      <XCircle size={14} />
      {loading ? "Cancelling…" : "Cancel Shipment"}
    </button>
  )
}
