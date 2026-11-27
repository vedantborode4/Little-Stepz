"use client"

import { useState } from "react"
import Link from "next/link"
import { PackageSearch, Loader2, Truck, ExternalLink } from "lucide-react"
import { trackOrderSchema } from "@repo/zod-schema/index"
import { GuestCheckoutService, type TrackedOrder } from "../../lib/services/guest-checkout.service"
import { friendlyError } from "../../lib/errorMessages"
import { useAuthStore } from "../../store/auth.store"

const inputClass = "w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-text text-sm"

/** Order status for anyone with the order number and the email or phone used on it. */
export default function TrackOrderPage() {
  const signedIn = useAuthStore((s) => !!s.user)
  const [reference, setReference] = useState("")
  const [contact, setContact] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TrackedOrder | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = trackOrderSchema.safeParse({ reference, contact })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the details and try again")
      return
    }
    try {
      setBusy(true)
      setError(null)
      setResult(await GuestCheckoutService.track(reference, contact))
    } catch (err) {
      setResult(null)
      const status = (err as { response?: { status?: number } })?.response?.status
      setError(
        status === 404
          ? "We couldn't find that order. Check the order number and the email or phone you used."
          : friendlyError(err, "Something went wrong. Please try again.")
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10 sm:py-14 space-y-5">
      <div className="text-center space-y-2">
        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
          <PackageSearch size={24} className="text-primary" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-text">Track your order</h1>
        <p className="text-sm text-muted">
          Enter the order number from your confirmation email and the email or phone number you ordered with.
        </p>
      </div>

      <form onSubmit={submit} className="bg-surface border border-border rounded-2xl shadow-card p-5 sm:p-6 space-y-3">
        <input
          value={reference}
          onChange={(e) => {
            setReference(e.target.value.toUpperCase().slice(0, 9))
            setError(null)
          }}
          placeholder="Order number, e.g. 3FB26BDB"
          className={`${inputClass} font-mono uppercase`}
        />
        <input
          value={contact}
          onChange={(e) => {
            setContact(e.target.value)
            setError(null)
          }}
          placeholder="Email or phone number"
          autoComplete="email"
          className={inputClass}
        />
        {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {busy && <Loader2 size={16} className="animate-spin" />}
          Track Order
        </button>
      </form>

      {result && (
        <div className="bg-surface border border-border rounded-2xl shadow-card p-5 sm:p-6 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted">Order</p>
              <p className="font-mono font-semibold text-text">#{result.reference}</p>
              <p className="text-xs text-muted mt-1">
                Placed on {new Date(result.placedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            <span className="text-xs px-3 py-1.5 rounded-full font-semibold bg-primary/10 text-primary">
              {result.status.replace(/_/g, " ")}
            </span>
          </div>
          {result.awbCode ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Truck size={15} className="text-primary shrink-0" />
              <span>
                {result.courierName ?? "Courier"} · AWB <span className="font-mono text-text">{result.awbCode}</span>
              </span>
              {result.trackingUrl && (
                <a href={result.trackingUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-primary inline-flex items-center gap-1 font-medium">
                  Courier tracking <ExternalLink size={13} />
                </a>
              )}
            </div>
          ) : (
            result.message && <p className="text-sm text-muted">{result.message}</p>
          )}
          <p className="text-xs text-faint">
            To cancel or return items, use the &ldquo;View your order&rdquo; link in your order email
            {signedIn ? (
              <>
                {" "}or open{" "}
                <Link href="/account/orders" className="text-primary font-medium">My Orders</Link>
              </>
            ) : null}
            .
          </p>
        </div>
      )}
    </div>
  )
}
