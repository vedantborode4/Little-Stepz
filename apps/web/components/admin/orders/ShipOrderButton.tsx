"use client"

import { useState } from "react"
import { Truck } from "lucide-react"
import { AdminOrderService, type OrderStatus } from "../../../lib/services/admin-order.service"
import { friendlyError } from "../../../lib/errorMessages"
import { toast } from "sonner"

interface Props {
  orderId: string
  currentStatus?: OrderStatus
  onSuccess: () => void
  refresh?: () => void
  /**
   * Outstanding balance, when this order is a partial-payment one that has not settled.
   * Dispatching such an order commits it to cash-on-delivery for exactly this amount and
   * closes the customer's option to pay online, so the admin is told before, not after.
   */
  balanceToCollect?: number | null
}

const SHIPPABLE_STATUSES: OrderStatus[] = ["CONFIRMED", "PROCESSING"]

export default function ShipOrderButton({ orderId, currentStatus, onSuccess, refresh, balanceToCollect }: Props) {
  const [loading, setLoading] = useState(false)

  const cb = onSuccess ?? refresh

  if (currentStatus && !SHIPPABLE_STATUSES.includes(currentStatus)) return null

  const ship = async () => {
    // A plain "Create shipment?" is not enough once dispatch is also the moment the
    // collection method is locked in — that decision is irreversible and involves money.
    const message = balanceToCollect
      ? `This will ship COD with ₹${balanceToCollect.toLocaleString("en-IN")} to collect at the door.

` +
        `The customer's option to pay the balance online will close immediately. Continue?`
      : "Create shipment for this order?"
    if (!confirm(message)) return
    setLoading(true)
    try {
      await AdminOrderService.createShipment(orderId)
      toast.success("Shipment created successfully")
      cb?.()
    } catch (e: any) {
      // Courier rejections carry an actionable reason (an unregistered pickup
      // warehouse, an unserviceable pincode). Give the admin longer to read it than
      // the default toast allows.
      toast.error(friendlyError(e, "Failed to create shipment"), { duration: 10000 })
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
