"use client"

import { useState } from "react"
import { toast } from "sonner"
import { RotateCcw, Truck, Loader2, ExternalLink } from "lucide-react"
import {
  ReturnService,
  RETURN_STATUS_LABEL,
  RETURN_STATUS_CLASS,
  type ReturnRequest,
} from "../../../lib/services/return.service"
import { friendlyError } from "../../../lib/errorMessages"

const money = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
const date = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" })

function nextStepCopy(r: ReturnRequest): string | null {
  switch (r.status) {
    case "PENDING": return "We're reviewing your request (2–3 business days)."
    case "APPROVED":
      return r.pickupStatus === "SCHEDULED"
        ? "Collection is arranged. Keep the items packed and ready."
        : "Approved. We'll arrange collection of the items."
    case "PICKED_UP": return "Collected. We'll inspect the items as soon as they reach us."
    case "RECEIVED": return "Received and inspected. Your refund is being processed."
    case "REFUNDED": return r.refundAmount ? `Refunded ${money(r.refundAmount)}.` : "Completed."
    case "INSPECTION_FAILED": return "The items didn't pass inspection, so no refund is due."
    case "REJECTED": return "This return wasn't approved."
    default: return null
  }
}

export default function OrderReturnsSection({
  orderId,
  returns,
  onChanged,
}: {
  orderId: string
  returns: ReturnRequest[]
  onChanged: () => void
}) {
  const [cancelling, setCancelling] = useState<string | null>(null)

  if (returns.length === 0) return null

  const cancel = async (id: string) => {
    if (!confirm("Cancel this return request?")) return
    setCancelling(id)
    try {
      await ReturnService.cancel(orderId, id)
      toast.success("Return cancelled")
      onChanged()
    } catch (e) {
      toast.error(friendlyError(e, "Couldn't cancel the return"))
    } finally {
      setCancelling(null)
    }
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-card space-y-4">
      <div className="flex items-center gap-2">
        <RotateCcw size={16} className="text-primary" />
        <h2 className="font-semibold text-text">Returns</h2>
      </div>

      {returns.map((r) => (
        <div key={r.id} className="rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-text">{r.reason}</p>
              <p className="text-xs text-muted mt-0.5">Requested {date(r.createdAt)}</p>
            </div>
            <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold whitespace-nowrap ${RETURN_STATUS_CLASS[r.status]}`}>
              {RETURN_STATUS_LABEL[r.status]}
            </span>
          </div>

          <ul className="text-sm text-muted space-y-1">
            {r.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3">
                <span className="truncate">
                  {i.productName}{i.variantName ? ` (${i.variantName})` : ""} × {i.quantity}
                  {i.acceptedQuantity != null && i.acceptedQuantity < i.quantity && (
                    <span className="text-xs text-faint"> · {i.acceptedQuantity} accepted</span>
                  )}
                </span>
              </li>
            ))}
          </ul>

          <div className="flex justify-between text-sm">
            <span className="text-muted">{r.refundAmount != null ? "Refund" : "Estimated refund"}</span>
            <span className="font-semibold text-text">{money(r.refundAmount ?? r.estimatedRefund)}</span>
          </div>

          {nextStepCopy(r) && <p className="text-xs text-muted">{nextStepCopy(r)}</p>}
          {r.adminNote && ["REJECTED", "INSPECTION_FAILED"].includes(r.status) && (
            <p className="text-xs text-muted"><span className="font-medium text-text">Note:</span> {r.adminNote}</p>
          )}
          {r.inspectionNote && r.status === "INSPECTION_FAILED" && (
            <p className="text-xs text-muted"><span className="font-medium text-text">Inspection:</span> {r.inspectionNote}</p>
          )}

          <div className="flex flex-wrap gap-2">
            {r.pickupTrackingUrl && (
              <a
                href={r.pickupTrackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-text hover:border-primary hover:text-primary transition"
              >
                <Truck size={13} /> Track pickup <ExternalLink size={11} />
              </a>
            )}
            {r.canCancel && (
              <button
                onClick={() => cancel(r.id)}
                disabled={cancelling === r.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-500/30 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15 transition disabled:opacity-60"
              >
                {cancelling === r.id && <Loader2 size={12} className="animate-spin" />} Cancel return
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
