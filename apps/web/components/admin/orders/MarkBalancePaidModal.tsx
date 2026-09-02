"use client"

import { useState } from "react"
import { toast } from "sonner"
import { AlertTriangle } from "lucide-react"
import { AdminOrderService } from "../../../lib/services/admin-order.service"
import { friendlyError } from "../../../lib/errorMessages"

const METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "UPI", label: "UPI" },
  { value: "OTHER", label: "Other" },
] as const

/**
 * Record a balance collected outside the gateway — a late COD remittance, a bank
 * transfer, or an order delivered without a COD manifest.
 *
 * This books real money on a person's word, so it captures who, how and against what
 * reference, and warns before recording a collection on an order that has not been
 * delivered yet. Without that warning the button is an easy way to mark uncollected
 * money as collected, which would pay affiliate commission on it and raise an invoice.
 */
export default function MarkBalancePaidModal({
  orderId,
  balanceAmount,
  orderStatus,
  refresh,
}: {
  orderId: string
  balanceAmount: number
  orderStatus: string
  refresh: () => void
}) {
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState<(typeof METHODS)[number]["value"]>("CASH")
  const [reference, setReference] = useState("")
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(false)

  const notDelivered = orderStatus !== "DELIVERED"

  const submit = async () => {
    setLoading(true)
    try {
      await AdminOrderService.markBalancePaid(orderId, {
        method,
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
      })
      toast.success("Balance recorded")
      setOpen(false)
      refresh()
    } catch (e: unknown) {
      toast.error(friendlyError(e, "Couldn't record the balance"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 border border-primary text-primary rounded-lg text-xs font-medium hover:bg-primary/10"
      >
        Mark balance paid
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h2 className="text-base font-semibold mb-1 text-text">Mark balance paid</h2>
            <p className="text-sm text-muted mb-4">
              Recording <span className="font-semibold text-text">
                ₹{balanceAmount.toLocaleString("en-IN")}
              </span> as collected for this order.
            </p>

            {notDelivered && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-500/15 border border-amber-100 dark:border-amber-500/20 px-3 py-2 mb-4">
                <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  This order hasn&apos;t been delivered yet ({orderStatus.toLowerCase().replace(/_/g, " ")}).
                  Only record an early settlement if you have actually received the money.
                </p>
              </div>
            )}

            <label className="block text-xs font-medium text-muted mb-1">How was it collected?</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as typeof method)}
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm mb-3 bg-surface"
            >
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>

            <label className="block text-xs font-medium text-muted mb-1">
              Reference <span className="text-faint">(UTR, receipt no., driver — anything that lets you reconcile it later)</span>
            </label>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              maxLength={120}
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm mb-3 bg-surface"
            />

            <label className="block text-xs font-medium text-muted mb-1">Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm mb-4 resize-none bg-surface"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 py-2.5 border border-border rounded-xl text-sm text-muted"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-primary disabled:opacity-60"
              >
                {loading ? "Recording…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
