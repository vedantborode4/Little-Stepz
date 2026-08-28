"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useOrderStore } from "../../../../store/useOrderStore"
import { OrderService } from "../../../../lib/services/order.service"
import { cldFill } from "../../../../lib/utils/cloudinaryUrl"
import {
  Package, MapPin, CreditCard, ArrowLeft,
  RotateCcw, XCircle, ChevronRight, Truck, CheckCircle, Clock, FileText, Loader2
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { friendlyError } from "../../../../lib/errorMessages"
import { refundMessage, REFUND_INITIATED_TEXT } from "@repo/content/index"

const STATUS_STEPS = [
  "PENDING", "CONFIRMED", "PROCESSING", "SHIPPED",
  "OUT_FOR_DELIVERY", "DELIVERED",
]

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-50 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
  CONFIRMED: "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300",
  PROCESSING: "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300",
  SHIPPED: "bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300",
  OUT_FOR_DELIVERY: "bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300",
  DELIVERED: "bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-300",
  CANCELLED: "bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400",
  RETURN_REQUESTED: "bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400",
  RETURN_APPROVED: "bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300",
  RETURN_REJECTED: "bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400",
  RETURNED: "bg-surface-2 text-muted",
  REFUND_INITIATED: "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  REFUNDED: "bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-300",
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
  /** Set once the cancellation succeeds — holds the refund sentence to show. */
  const [done, setDone] = useState<string | null>(null)

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
        onDone()
      } else {
        // The API already reports what happened to the money ("initiated" | "none" |
        // "failed"); this was being discarded, so a cancelling customer was told
        // nothing about their refund and had to ask support.
        const res = await OrderService.cancelOrder(orderId, reason)
        setDone(refundMessage(res?.refund))
        toast.success("Order cancelled")
      }
    } catch (e: any) {
      toast.error(friendlyError(e, `Failed to ${mode} order`))
    } finally {
      setLoading(false)
    }
  }

  // Money information does not belong in a toast that vanishes after 4 seconds.
  if (done) {
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-surface rounded-2xl w-full max-w-md shadow-2xl p-6 text-center">
          <CheckCircle size={40} className="mx-auto text-green-500 mb-3" />
          <h2 className="text-base font-semibold text-text mb-2">Order cancelled</h2>
          <p className="text-sm text-muted mb-6">{done}</p>
          <button
            onClick={onDone}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-primary hover:opacity-90 transition"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-text">
            {mode === "return" ? "Request Return" : "Cancel Order"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 text-faint">
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
              <label key={r} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/30 cursor-pointer transition">
                <input
                  type="radio"
                  name="reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="accent-primary"
                />
                <span className="text-sm text-muted">{r}</span>
              </label>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-border rounded-xl text-sm text-muted hover:bg-surface-2 transition"
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
  const [downloading, setDownloading] = useState(false)

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
          <div key={i} className="bg-surface border rounded-2xl p-6 animate-pulse">
            <div className="h-4 bg-surface-2 rounded w-1/3 mb-3" />
            <div className="h-3 bg-surface-2 rounded w-1/2" />
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
        className="flex items-center gap-2 text-sm text-muted hover:text-text transition"
      >
        <ArrowLeft size={15} /> Back to Orders
      </button>

      {/* Header */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-card">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-text">Order Details</h1>
            <p className="text-xs font-mono text-muted mt-0.5">{o.id}</p>
            <p className="text-xs text-muted mt-1">
              Placed on {new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${STATUS_COLORS[status] ?? "bg-surface-2 text-muted"}`}>
            {status.replace(/_/g, " ")}
          </span>
        </div>

        {/* A cancelled prepaid order still owes the customer money — say so where
            they can find it again, not only in a toast they've already dismissed. */}
        {status === "CANCELLED" && o.paymentMethod !== "COD" && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 px-4 py-3">
            <CreditCard size={16} className="text-indigo-600 dark:text-indigo-300 mt-0.5 shrink-0" />
            <p className="text-xs text-indigo-800 dark:text-indigo-200">{REFUND_INITIATED_TEXT}</p>
          </div>
        )}

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
                      ${done ? "bg-primary text-white" : "bg-surface-2 text-faint"}`}>
                      {done ? <CheckCircle size={14} /> : i + 1}
                    </div>
                    {!last && <div className={`flex-1 h-1 mx-1 rounded ${i < statusStep ? "bg-primary" : "bg-surface-2"}`} />}
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
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Package size={16} className="text-primary" />
          <h2 className="font-semibold text-text">Items ({o.items?.length ?? 0})</h2>
        </div>

        {o.items?.map((item: any) => (
          <div key={item.id} className="flex items-center gap-4 py-3 border-t border-border first:border-0">
            {(item.variant?.images?.[0]?.url || item.product?.images?.[0]?.url) ? (
              <img
                src={cldFill(item.variant?.images?.[0]?.url || item.product.images[0].url, 200)}
                alt={item.product.name}
                className="w-14 h-14 object-cover rounded-xl border border-border"
              />
            ) : (
              <div className="w-14 h-14 bg-surface-2 rounded-xl flex items-center justify-center">
                <Package size={18} className="text-faint" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text truncate">{item.product?.name}</p>
              {item.variant && <p className="text-xs text-muted mt-0.5">{item.variant.name}</p>}
              <p className="text-xs text-muted mt-0.5">Qty: {item.quantity}</p>
            </div>
            <p className="text-sm font-semibold text-text">₹{(Number(item.price) * Number(item.quantity)).toLocaleString("en-IN")}</p>
          </div>
        ))}
      </div>

      {/* Price Summary */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-card space-y-3">
        <h2 className="font-semibold text-text mb-1">Price Summary</h2>
        {[
          { label: "Subtotal", value: o.subtotal },
          { label: "Discount", value: o.discount, negative: true },
          { label: "Shipping", value: o.shippingCharges },
        ].map(({ label, value, negative }) =>
          value != null && Number(value) > 0 ? (
            <div key={label} className="flex justify-between text-sm text-muted">
              <span>{label}</span>
              <span className={negative ? "text-green-600 dark:text-green-400" : ""}>
                {negative ? "-" : ""}₹{Number(value).toLocaleString("en-IN")}
              </span>
            </div>
          ) : null
        )}
        <div className="flex justify-between font-bold text-text pt-2 border-t border-border">
          <span>Total</span>
          <span>₹{Number(o.total).toLocaleString("en-IN")}</span>
        </div>
      </div>

      {/* Delivery & Payment */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <MapPin size={15} className="text-primary" />
            <h2 className="font-semibold text-text text-sm">Delivery Address</h2>
          </div>
          {addr ? (
            <div className="text-sm text-muted space-y-0.5 leading-relaxed">
              <p className="font-medium text-text">{addr?.name ?? addr?.fullName ?? "—"}</p>
              <p>{addr?.line1}</p>
              {addr?.line2 && <p>{addr?.line2}</p>}
              <p>{addr?.city}, {addr?.state} – {addr?.pincode}</p>
              {addr?.phone && <p className="text-muted">{addr?.phone}</p>}
            </div>
          ) : (
            <p className="text-sm text-muted">Address not available</p>
          )}
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard size={15} className="text-primary" />
            <h2 className="font-semibold text-text text-sm">Payment</h2>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Method</span>
              <span className="text-muted font-medium capitalize">
                {o.paymentMethod?.replace(/_/g, " ") ?? "—"}
              </span>
            </div>
            {o.payment && (
              <div className="flex justify-between">
                <span className="text-muted">Status</span>
                <span className={`font-medium ${o.payment.status === "SUCCESS" ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                  {o.payment.status}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Invoice — only a paid order has one to download. */}
      {o.payment?.status === "SUCCESS" && (
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-card">
          <h2 className="font-semibold text-text text-sm mb-3">Invoice</h2>
          <button
            onClick={async () => {
              if (downloading) return
              setDownloading(true)
              try {
                await OrderService.downloadInvoice(o.id)
              } catch (err: any) {
                toast.error(friendlyError(err, "Couldn't download the invoice"))
              } finally {
                setDownloading(false)
              }
            }}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text hover:border-primary hover:text-primary transition disabled:opacity-50"
          >
            {downloading ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
            {downloading ? "Preparing…" : "Download Invoice"}
          </button>
          <p className="text-xs text-muted mt-2">
            A copy was also emailed to you when the order was confirmed.
          </p>
        </div>
      )}

      {/* Actions */}
      {(canCancel || canReturn) && (
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-card">
          <h2 className="font-semibold text-text text-sm mb-3">Order Actions</h2>
          <div className="flex flex-wrap gap-3">
            {canCancel && (
              <button
                onClick={() => setModal("cancel")}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-500/15 transition"
              >
                <XCircle size={15} /> Cancel Order
              </button>
            )}
            {canReturn && (
              <button
                onClick={() => setModal("return")}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-orange-200 dark:border-orange-500/30 text-orange-600 dark:text-orange-400 text-sm font-medium hover:bg-orange-50 dark:hover:bg-orange-500/15 transition"
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
