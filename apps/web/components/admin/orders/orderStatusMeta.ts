import { OrderStatus } from "../../../lib/services/admin-order.service"

export const orderStatusMeta: Record<
  OrderStatus,
  { label: string; className: string }
> = {
  PENDING: { label: "Pending", className: "bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400" },
  CONFIRMED: { label: "Confirmed", className: "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400" },
  PROCESSING: { label: "Processing", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300" },
  SHIPPED: { label: "Shipped", className: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", className: "bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400" },
  DELIVERED: { label: "Delivered", className: "bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400" },

  CANCELLED: { label: "Cancelled", className: "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400" },

  RETURN_REQUESTED: { label: "Return requested", className: "bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400" },
  RETURN_APPROVED: { label: "Return approved", className: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" },
  RETURN_REJECTED: { label: "Return rejected", className: "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400" },
  RETURNED: { label: "Returned", className: "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300" },

  REFUND_INITIATED: { label: "Refund initiated", className: "bg-pink-100 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400" },
  REFUNDED: { label: "Refunded", className: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400" },
}