"use client"

import { useState } from "react"
import { AdminOrderService, type AdminOrder, type OrderStatus } from "../../../lib/services/admin-order.service"
import { toast } from "sonner"

interface Props {
  order: AdminOrder
  refresh: () => void
}

const transitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: ["RETURN_REQUESTED"],
  CANCELLED: [],
  RETURN_REQUESTED: ["RETURN_APPROVED", "RETURN_REJECTED"],
  RETURN_APPROVED: ["RETURNED", "REFUND_INITIATED"],
  RETURN_REJECTED: [],
  RETURNED: ["REFUND_INITIATED"],
  REFUND_INITIATED: ["REFUNDED"],
  REFUNDED: [],
}

export default function OrderActions({ order, refresh }: Props) {
  const nextStatuses = transitions[order.status as OrderStatus] ?? []
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  if (!nextStatuses.length) return null

  const handleSelect = (value: OrderStatus) => { setSelectedStatus(value); setIsOpen(true) }

  const handleConfirm = async () => {
    if (!selectedStatus) return
    setLoading(true)
    try {
      // PUT /admin/orders/:id/status  body: { status }
      await AdminOrderService.updateStatus(order.id, selectedStatus)
      toast.success(`Order status updated to ${selectedStatus}`)
      refresh()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to update status")
    } finally {
      setLoading(false)
      setIsOpen(false)
      setSelectedStatus(null)
    }
  }

  return (
    <>
      <select
        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
        defaultValue=""
        onChange={e => handleSelect(e.target.value as OrderStatus)}
      >
        <option value="" disabled>Update Status</option>
        {nextStatuses.map(s => (
          <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
        ))}
      </select>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-96">
            <h2 className="text-base font-semibold mb-3 text-gray-900">Confirm Status Change</h2>
            <p className="text-sm text-gray-600 mb-6">
              Change order status from <strong>{order.status}</strong> to <strong>{selectedStatus}</strong>?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setIsOpen(false); setSelectedStatus(null) }}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
                disabled={loading}>
                Cancel
              </button>
              <button onClick={handleConfirm}
                className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
                disabled={loading}>
                {loading ? "Updating…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
