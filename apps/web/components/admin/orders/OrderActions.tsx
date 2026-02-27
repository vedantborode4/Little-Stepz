"use client"

import { useState } from "react"
import {
  AdminOrder,
  AdminOrderService,
  OrderStatus,
} from "../../../lib/services/admin-order.service"

interface Props {
  order: AdminOrder
  refresh: () => void
}

const transitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED"],
  SHIPPED: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: ["RETURN_REQUESTED"],
  CANCELLED: [],
  RETURN_REQUESTED: ["RETURN_APPROVED", "RETURN_REJECTED"],
  RETURN_APPROVED: ["RETURNED"],
  RETURN_REJECTED: [],
  RETURNED: ["REFUND_INITIATED"],
  REFUND_INITIATED: ["REFUNDED"],
  REFUNDED: [],
}

export default function OrderActions({ order, refresh }: Props) {
  const currentStatus = order.status as OrderStatus
  const nextStatuses: OrderStatus[] = transitions[currentStatus] || []

  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  if (!nextStatuses.length) return null

  const handleSelect = (value: OrderStatus) => {
    setSelectedStatus(value)
    setIsOpen(true)
  }

  const handleConfirm = async () => {
    if (!selectedStatus) return
    try {
      setLoading(true)
      await AdminOrderService.updateStatus(order.id, selectedStatus)
      refresh()
    } finally {
      setLoading(false)
      setIsOpen(false)
      setSelectedStatus(null)
    }
  }

  return (
    <>
      <select
        className="border border-gray-200 rounded-lg px-2 py-1"
        defaultValue=""
        onChange={(e) => handleSelect(e.target.value as OrderStatus)}
      >
        <option value="" disabled>
          Change
        </option>

        {nextStatuses.map((s: OrderStatus) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-lg p-6 w-96">
            <h2 className="text-lg font-semibold mb-4">
              Confirm Status Change
            </h2>

            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to change the order status from{" "}
              <span className="font-medium">{currentStatus}</span> to{" "}
              <span className="font-medium">{selectedStatus}</span>?
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsOpen(false)
                  setSelectedStatus(null)
                }}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm"
                disabled={loading}
              >
                Cancel
              </button>

              <button
                onClick={handleConfirm}
                className="px-4 py-2 rounded-lg bg-black text-white text-sm"
                disabled={loading}
              >
                {loading ? "Updating..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}