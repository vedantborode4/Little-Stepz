"use client"

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

  if (!nextStatuses.length) return null

  const handleChange = async (value: OrderStatus) => {
    await AdminOrderService.updateStatus(order.id, value)
    refresh()
  }

  return (
    <select
      className="border rounded-lg px-2 py-1"
      defaultValue=""
      onChange={(e) => handleChange(e.target.value as OrderStatus)}
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
  )
}