"use client"

import { useState } from "react"
import { Truck } from "lucide-react"
import { AdminOrderService, type OrderStatus } from "../../../lib/services/admin-order.service"
import { toast } from "sonner"

interface Props {
  orderId: string
  currentStatus?: OrderStatus
  onSuccess: () => void
  refresh?: () => void
}

const SHIPPABLE_STATUSES: OrderStatus[] = ["CONFIRMED", "PROCESSING"]

export default function ShipOrderButton({ orderId, currentStatus, onSuccess, refresh }: Props) {
  const [loading, setLoading] = useState(false)

  const cb = onSuccess ?? refresh

  if (currentStatus && !SHIPPABLE_STATUSES.includes(currentStatus)) return null

  const ship = async () => {
    if (!confirm("Create shipment for this order?")) return
    setLoading(true)
    try {
      await AdminOrderService.createShipment(orderId)
      toast.success("Shipment created successfully")
      cb?.()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to create shipment")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={ship}
      disabled={loading}
      className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition disabled:opacity-60"
    >
      <Truck size={14} />
      {loading ? "Shipping…" : "Ship Order"}
    </button>
  )
}
