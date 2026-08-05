"use client"

import AuthGuard from "../../../../components/guard/AuthGuard"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  Package, CreditCard, ArrowLeft, ChevronRight,
  Clock, CheckCircle, XCircle, RotateCcw, AlertCircle
} from "lucide-react"
import { PreOrderService, type PreOrderSummary, type PreOrderStatus } from "../../../../lib/services/preorder.service"
import { cldFill } from "../../../../lib/utils/cloudinaryUrl"

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`

const STATUS_META: Record<PreOrderStatus, { label: string; color: string; icon: any }> = {
  PENDING_BOOKING:  { label: "Pending",          color: "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30",    icon: Clock },
  BOOKED:           { label: "Awaiting Restock",  color: "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30",       icon: Package },
  AWAITING_BALANCE: { label: "Balance Due",       color: "bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/30", icon: AlertCircle },
  COMPLETED:        { label: "Completed",         color: "bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-300 border-green-200 dark:border-green-500/30",    icon: CheckCircle },
  EXPIRED:          { label: "Expired",           color: "bg-surface-2 text-muted border-border",      icon: XCircle },
  CANCELLED:        { label: "Cancelled",         color: "bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30",          icon: XCircle },
  REFUNDED:         { label: "Refunded",          color: "bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/30", icon: RotateCcw },
}

// Happy-path booking flow (terminal states render only the badge)
const STATUS_STEPS: { key: PreOrderStatus; label: string }[] = [
  { key: "PENDING_BOOKING",  label: "Booked" },
  { key: "BOOKED",           label: "Awaiting Restock" },
  { key: "AWAITING_BALANCE", label: "Balance Due" },
  { key: "COMPLETED",        label: "Completed" },
]

function fmtDate(d?: string | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
}

export default function PreOrderDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [po, setPo] = useState<PreOrderSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    PreOrderService.getById(id)
      .then(setPo)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  if (loading || !po) {
    return (
      <AuthGuard>
        <div className="max-w-3xl mx-auto px-4 py-10 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface border rounded-2xl p-6 animate-pulse">
              <div className="h-4 bg-surface-2 rounded w-1/3 mb-3" />
              <div className="h-3 bg-surface-2 rounded w-1/2" />
            </div>
          ))}
        </div>
      </AuthGuard>
    )
  }

  const meta = STATUS_META[po.status] ?? { label: po.status, color: "bg-surface-2 text-muted border-border", icon: AlertCircle }
  const StatusIcon = meta.icon
  const stepIndex = STATUS_STEPS.findIndex((s) => s.key === po.status)
  const showSteps = stepIndex !== -1
  const subtotal = Number(po.unitPrice) * Number(po.quantity)

  return (
    <AuthGuard>
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-5">
        {/* Back */}
        <button
          onClick={() => router.push("/account/pre-orders")}
          className="flex items-center gap-2 text-sm text-muted hover:text-text transition"
        >
          <ArrowLeft size={15} /> Back to Pre-Orders
        </button>

        {/* Header */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-card">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-lg font-bold text-text">Pre-Order Details</h1>
              <p className="text-xs font-mono text-muted mt-0.5">{po.id}</p>
              <p className="text-xs text-muted mt-1">
                Booked on {fmtDate(po.createdAt)}
              </p>
            </div>
            <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold border ${meta.color}`}>
              <StatusIcon size={12} />
              {meta.label}
            </span>
          </div>

          {/* Progress (happy path only) */}
          {showSteps && (
            <div className="mt-6">
              <div className="flex items-center justify-between">
                {STATUS_STEPS.map((s, i) => {
                  const done = i <= stepIndex
                  const last = i === STATUS_STEPS.length - 1
                  return (
                    <div key={s.key} className={`flex items-center ${!last ? "flex-1" : ""}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold transition
                        ${done ? "bg-primary text-white" : "bg-surface-2 text-faint"}`}>
                        {done ? <CheckCircle size={14} /> : i + 1}
                      </div>
                      {!last && <div className={`flex-1 h-1 mx-1 rounded ${i < stepIndex ? "bg-primary" : "bg-surface-2"}`} />}
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between mt-1.5">
                {STATUS_STEPS.map((s) => (
                  <span key={s.key} className="text-[9px] text-muted text-center" style={{ width: "25%" }}>
                    {s.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Product */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Package size={16} className="text-primary" />
            <h2 className="font-semibold text-text">Product</h2>
          </div>
          <div className="flex items-center gap-4">
            <img
              src={cldFill(po.product.images?.[0]?.url || "/placeholder.webp", 200)}
              alt={po.product.name}
              className="w-16 h-16 object-cover rounded-xl border border-border shrink-0"
            />
            <div className="flex-1 min-w-0">
              <Link href={`/products/${po.product.slug}`} className="text-sm font-medium text-text hover:text-primary line-clamp-2 leading-snug transition-colors">
                {po.product.name}
              </Link>
              {po.variant && <p className="text-xs text-muted mt-0.5">{po.variant.name}</p>}
              <p className="text-xs text-muted mt-0.5">Qty: {po.quantity}</p>
            </div>
            <p className="text-sm font-semibold text-text">{inr(subtotal)}</p>
          </div>
        </div>

        {/* Payment Summary */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-card space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard size={15} className="text-primary" />
            <h2 className="font-semibold text-text">Payment Summary</h2>
          </div>
          {[
            { label: `Subtotal (${po.quantity} × ${inr(po.unitPrice)})`, value: subtotal },
            { label: "Shipping", value: po.shippingCharges },
          ].map(({ label, value }) =>
            value != null && Number(value) > 0 ? (
              <div key={label} className="flex justify-between text-sm text-muted">
                <span>{label}</span>
                <span>{inr(value)}</span>
              </div>
            ) : null
          )}
          <div className="flex justify-between font-bold text-text pt-2 border-t border-border">
            <span>Order Total</span>
            <span>{inr(po.totalAmount)}</span>
          </div>
          <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
            <span>Booking paid{po.bookingPaidAt ? ` · ${fmtDate(po.bookingPaidAt)}` : ""}</span>
            <span>{inr(po.bookingAmount)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">
              Balance {po.balancePaidAt ? "paid" : "remaining"}
              {po.balanceDueAt && !po.balancePaidAt ? ` · due ${fmtDate(po.balanceDueAt)}` : ""}
            </span>
            <span className={po.balancePaidAt ? "text-green-600 dark:text-green-400 font-medium" : "text-text font-semibold"}>
              {inr(po.balanceAmount)}
            </span>
          </div>
        </div>

        {/* Actions */}
        {((po.status === "AWAITING_BALANCE" && po.balanceToken) || (po.status === "COMPLETED" && po.orderId)) && (
          <div className="bg-surface border border-border rounded-2xl p-5 shadow-card">
            <h2 className="font-semibold text-text text-sm mb-3">Actions</h2>
            {po.status === "AWAITING_BALANCE" && po.balanceToken && (
              <>
                <Link
                  href={`/pre-orders/pay/${po.balanceToken}`}
                  className="inline-flex items-center justify-center bg-primary text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition"
                >
                  Pay Balance {inr(po.balanceAmount)}
                </Link>
                <p className="text-xs text-muted mt-2">
                  Your item is back in stock. Pay the remaining balance to complete your order.
                </p>
              </>
            )}
            {po.status === "COMPLETED" && po.orderId && (
              <Link
                href={`/account/orders/${po.orderId}`}
                className="inline-flex items-center gap-1 text-sm text-primary font-medium hover:gap-2 transition-all"
              >
                View linked order <ChevronRight size={14} />
              </Link>
            )}
          </div>
        )}
      </div>
    </AuthGuard>
  )
}
