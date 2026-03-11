"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useOrderStore } from "../../../../store/useOrderStore"
import { OrderService } from "../../../../lib/services/order.service"
import {
  Package, MapPin, CreditCard, ArrowLeft,
  RotateCcw, XCircle, ChevronRight, Truck, CheckCircle, Clock
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

const STATUS_STEPS = [
  "PENDING", "CONFIRMED", "PROCESSING", "SHIPPED",
  "OUT_FOR_DELIVERY", "DELIVERED",
]

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700",
  CONFIRMED: "bg-blue-50 text-blue-700",
  PROCESSING: "bg-blue-50 text-blue-700",
  SHIPPED: "bg-purple-50 text-purple-700",
  OUT_FOR_DELIVERY: "bg-purple-50 text-purple-700",
  DELIVERED: "bg-green-50 text-green-700",
  CANCELLED: "bg-red-50 text-red-600",
  RETURN_REQUESTED: "bg-orange-50 text-orange-600",
  RETURN_APPROVED: "bg-teal-50 text-teal-700",
  RETURN_REJECTED: "bg-red-50 text-red-600",
  RETURNED: "bg-gray-100 text-gray-600",
  REFUND_INITIATED: "bg-indigo-50 text-indigo-700",
  REFUNDED: "bg-green-50 text-green-700",
}

// Statuses where cancel is still possible
const CAN_CANCEL = new Set(["PENDING", "CONFIRMED"])
// Statuses where a return can be requested
const CAN_RETURN = new Set(["DELIVERED"])

function ReturnCancelModal({
  mode,
  orderId,
  onClose,
  onDone,
}: {
  mode: "return" | "cancel"
  orderId: string
  onClose: () => void
  onDone: () => void
}) {
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)

  const RETURN_REASONS = [
    "Damaged or defective item",
    "Wrong item delivered",
    "Item not as described",
    "Changed my mind",
    "Other",
  ]

  const CANCEL_REASONS = [
    "Ordered by mistake",
    "Found a better price",
    "Shipping taking too long",
    "Payment issue",
    "Other",
  ]

  const reasons = mode === "return" ? RETURN_REASONS : CANCEL_REASONS

  const submit = async () => {
    if (!reason) { toast.error("Please select a reason"); return }
    setLoading(true)
    try {
      if (mode === "return") {
        await OrderService.requestReturn(orderId, reason)
        toast.success("Return request submitted")
      } else {
        await OrderService.cancelOrder(orderId, reason)
        toast.success("Order cancelled")
      }
      onDone()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || `Failed to ${mode} order`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {mode === "return" ? "Request Return" : "Cancel Order"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <XCircle size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-muted">
            {mode === "return"
              ? "Please tell us why you want to return this item."
              : "Please let us know why you're cancelling."}
          </p>

          <div className="space-y-2">
            {reasons.map((r) => (
              <label key={r} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-primary/30 cursor-pointer transition">
                <input
                  type="radio"
                  name="reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="accent-primary"
                />
                <span className="text-sm text-gray-700">{r}</span>
              </label>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition"
            >
              Never mind
            </button>
            <button
              onClick={submit}
              disabled={loading || !reason}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition disabled:opacity-60
                ${mode === "return" ? "bg-orange-500 hover:bg-orange-600" : "bg-red-500 hover:bg-red-600"}`}
            >
              {loading ? "Submitting…" : mode === "return" ? "Submit Return" : "Cancel Order"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function OrderDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { currentOrder, fetchOrderById, loading } = useOrderStore()
  const [modal, setModal] = useState<"return" | "cancel" | null>(null)

  useEffect(() => {
    fetchOrderById(id)
  }, [id])

  const refresh = () => {
    setModal(null)
    fetchOrderById(id)
  }

  if (loading || !currentOrder) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white border rounded-2xl p-6 animate-pulse">
            <div className="h-4 bg-gray-100 rounded w-1/3 mb-3" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  const o = currentOrder
  const addr = o?.shippingAddress ?? o?.address ?? null
  const status = o.status?.toUpperCase() as string
  const statusStep = STATUS_STEPS.indexOf(status)
  const isActive = statusStep !== -1
  const canCancel = CAN_CANCEL.has(status)
  const canReturn = CAN_RETURN.has(status)

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-5">
      {/* Back */}
      <button
        onClick={() => router.push("/account/orders")}
        className="flex items-center gap-2 text-sm text-muted hover:text-gray-800 transition"
      >
        <ArrowLeft size={15} /> Back to Orders
      </button>

      {/* Header */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-card">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Order Details</h1>
            <p className="text-xs font-mono text-muted mt-0.5">{o.id}</p>
            <p className="text-xs text-muted mt-1">
              Placed on {new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600"}`}>
            {status.replace(/_/g, " ")}
          </span>
        </div>

        {/* Progress bar (only for normal fulfilment flow) */}
        {isActive && (
          <div className="mt-6">
            <div className="flex items-center justify-between">
              {STATUS_STEPS.map((s, i) => {
                const done = i <= statusStep
                const last = i === STATUS_STEPS.length - 1
                return (
                  <div key={s} className={`flex items-center ${!last ? "flex-1" : ""}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold transition
                      ${done ? "bg-primary text-white" : "bg-gray-100 text-gray-400"}`}>
                      {done ? <CheckCircle size={14} /> : i + 1}
                    </div>
                    {!last && <div className={`flex-1 h-1 mx-1 rounded ${i < statusStep ? "bg-primary" : "bg-gray-100"}`} />}
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between mt-1.5">
              {STATUS_STEPS.map((s) => (
                <span key={s} className="text-[9px] text-muted text-center" style={{ width: "14%" }}>
                  {s.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Package size={16} className="text-primary" />
          <h2 className="font-semibold text-gray-900">Items ({o.items?.length ?? 0})</h2>
        </div>

        {o.items?.map((item: any) => (
          <div key={item.id} className="flex items-center gap-4 py-3 border-t border-gray-50 first:border-0">
            {item.product?.images?.[0]?.url ? (
              <img
                src={item.product.images[0].url}
                alt={item.product.name}
                className="w-14 h-14 object-cover rounded-xl border border-gray-100"
              />
            ) : (
              <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center">
                <Package size={18} className="text-gray-300" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{item.product?.name}</p>
              {item.variant && <p className="text-xs text-muted mt-0.5">{item.variant.name}</p>}
              <p className="text-xs text-muted mt-0.5">Qty: {item.quantity}</p>
            </div>
            <p className="text-sm font-semibold text-gray-900">₹{(Number(item.price) * Number(item.quantity)).toLocaleString("en-IN")}</p>
          </div>
        ))}
      </div>

      {/* Price Summary */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-card space-y-3">
        <h2 className="font-semibold text-gray-900 mb-1">Price Summary</h2>
        {[
          { label: "Subtotal", value: o.subtotal },
          { label: "Discount", value: o.discount, negative: true },
          { label: "Shipping", value: o.shippingCharges },
        ].map(({ label, value, negative }) =>
          value != null && Number(value) > 0 ? (
            <div key={label} className="flex justify-between text-sm text-gray-600">
              <span>{label}</span>
              <span className={negative ? "text-green-600" : ""}>
                {negative ? "-" : ""}₹{Number(value).toLocaleString("en-IN")}
              </span>
            </div>
          ) : null
        )}
        <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-100">
          <span>Total</span>
          <span>₹{Number(o.total).toLocaleString("en-IN")}</span>
        </div>
      </div>

      {/* Delivery & Payment */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <MapPin size={15} className="text-primary" />
            <h2 className="font-semibold text-gray-900 text-sm">Delivery Address</h2>
          </div>
          {addr ? (
            <div className="text-sm text-gray-600 space-y-0.5 leading-relaxed">
              <p className="font-medium text-gray-900">{addr?.name ?? addr?.fullName ?? "—"}</p>
              <p>{addr?.line1}</p>
              {addr?.line2 && <p>{addr?.line2}</p>}
              <p>{addr?.city}, {addr?.state} – {addr?.pincode}</p>
              {addr?.phone && <p className="text-muted">{addr?.phone}</p>}
            </div>
          ) : (
            <p className="text-sm text-muted">Address not available</p>
          )}
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard size={15} className="text-primary" />
            <h2 className="font-semibold text-gray-900 text-sm">Payment</h2>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Method</span>
              <span className="text-gray-700 font-medium capitalize">
                {o.paymentMethod?.replace(/_/g, " ") ?? "—"}
              </span>
            </div>
            {o.payment && (
              <div className="flex justify-between">
                <span className="text-muted">Status</span>
                <span className={`font-medium ${o.payment.status === "SUCCESS" ? "text-green-600" : "text-red-500"}`}>
                  {o.payment.status}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      {(canCancel || canReturn) && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-card">
          <h2 className="font-semibold text-gray-900 text-sm mb-3">Order Actions</h2>
          <div className="flex flex-wrap gap-3">
            {canCancel && (
              <button
                onClick={() => setModal("cancel")}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition"
              >
                <XCircle size={15} /> Cancel Order
              </button>
            )}
            {canReturn && (
              <button
                onClick={() => setModal("return")}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-orange-200 text-orange-600 text-sm font-medium hover:bg-orange-50 transition"
              >
                <RotateCcw size={15} /> Request Return
              </button>
            )}
          </div>
          <p className="text-xs text-muted mt-2">
            {canCancel && "Orders can be cancelled while in Pending or Confirmed status."}
            {canReturn && "Returns can be requested within the return window after delivery."}
          </p>
        </div>
      )}

      {modal && (
        <ReturnCancelModal
          mode={modal}
          orderId={o.id}
          onClose={() => setModal(null)}
          onDone={refresh}
        />
      )}
    </div>
  )
}
