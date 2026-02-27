import { OrderStatus } from "../../../lib/services/admin-order.service"

export const orderStatusMeta: Record<
  OrderStatus,
  { label: string; className: string }
> = {
  PENDING: { label: "Pending", className: "bg-gray-100 text-gray-600" },
  CONFIRMED: { label: "Confirmed", className: "bg-blue-100 text-blue-600" },
  PROCESSING: { label: "Processing", className: "bg-yellow-100 text-yellow-700" },
  SHIPPED: { label: "Shipped", className: "bg-indigo-100 text-indigo-600" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", className: "bg-purple-100 text-purple-600" },
  DELIVERED: { label: "Delivered", className: "bg-green-100 text-green-600" },

  CANCELLED: { label: "Cancelled", className: "bg-red-100 text-red-600" },

  RETURN_REQUESTED: { label: "Return requested", className: "bg-orange-100 text-orange-600" },
  RETURN_APPROVED: { label: "Return approved", className: "bg-amber-100 text-amber-700" },
  RETURN_REJECTED: { label: "Return rejected", className: "bg-red-100 text-red-600" },
  RETURNED: { label: "Returned", className: "bg-slate-200 text-slate-700" },

  REFUND_INITIATED: { label: "Refund initiated", className: "bg-pink-100 text-pink-600" },
  REFUNDED: { label: "Refunded", className: "bg-emerald-100 text-emerald-600" },
}