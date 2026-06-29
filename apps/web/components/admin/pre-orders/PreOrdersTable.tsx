"use client"

import { useState } from "react"
import { toast } from "sonner"
import { AdminPreOrderService, type AdminPreOrder, type PreOrderStatus } from "../../../lib/services/admin-preorder.service"

const STATUS_STYLES: Record<PreOrderStatus, string> = {
  PENDING_BOOKING: "bg-gray-100 text-gray-500",
  BOOKED: "bg-blue-50 text-blue-600",
  AWAITING_BALANCE: "bg-amber-50 text-amber-600",
  COMPLETED: "bg-green-50 text-green-600",
  EXPIRED: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-red-50 text-red-500",
  REFUNDED: "bg-purple-50 text-purple-600",
}

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`

export default function PreOrdersTable({ data, refresh }: { data: AdminPreOrder[]; refresh: () => void }) {
  const [busyId, setBusyId] = useState<string | null>(null)

  const run = async (id: string, fn: () => Promise<any>, ok: string) => {
    setBusyId(id)
    try {
      await fn()
      toast.success(ok)
      refresh()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Action failed")
    } finally {
      setBusyId(null)
    }
  }

  if (!data.length) {
    return <div className="py-16 text-center text-gray-400 bg-white border border-gray-100 rounded-2xl">No pre-orders found</div>
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="p-4">Customer</th>
              <th className="p-4">Product</th>
              <th className="p-4">Booking / Balance</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((po) => (
              <tr key={po.id}>
                <td className="p-4">
                  <p className="font-medium text-gray-900">{po.user?.name}</p>
                  <p className="text-xs text-gray-400">{po.user?.email}</p>
                </td>
                <td className="p-4">
                  <p className="text-gray-900 max-w-[200px] truncate">{po.product?.name}</p>
                  <p className="text-xs text-gray-400">
                    {po.variant?.name ? `${po.variant.name} · ` : ""}Qty {po.quantity}
                  </p>
                </td>
                <td className="p-4 text-gray-700">
                  <p>{inr(po.bookingAmount)} <span className="text-xs text-gray-400">paid</span></p>
                  <p className="text-xs text-gray-400">{inr(po.balanceAmount)} balance</p>
                </td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[po.status]}`}>
                    {po.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-end gap-2">
                    {po.status === "AWAITING_BALANCE" && (
                      <button
                        disabled={busyId === po.id}
                        onClick={() => run(po.id, () => AdminPreOrderService.resendLink(po.id), "Balance link resent")}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 border border-blue-200 hover:bg-blue-50 disabled:opacity-50"
                      >
                        Resend link
                      </button>
                    )}
                    {(po.status === "BOOKED" || po.status === "AWAITING_BALANCE" || po.status === "EXPIRED") && po.bookingPaidAt && (
                      <button
                        disabled={busyId === po.id}
                        onClick={() => run(po.id, () => AdminPreOrderService.refundBooking(po.id), "Booking refunded")}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-purple-600 border border-purple-200 hover:bg-purple-50 disabled:opacity-50"
                      >
                        Refund booking
                      </button>
                    )}
                    {po.status !== "COMPLETED" && po.status !== "CANCELLED" && po.status !== "REFUNDED" && (
                      <button
                        disabled={busyId === po.id}
                        onClick={() => run(po.id, () => AdminPreOrderService.cancel(po.id), "Pre-order cancelled")}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 border border-red-200 hover:bg-red-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    )}
                    {po.orderId && (
                      <a
                        href={`/admin/orders/${po.orderId}`}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50"
                      >
                        View order
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
