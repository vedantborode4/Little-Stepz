"use client"

import { useState } from "react"
import { MapPin, Loader2, Check, X } from "lucide-react"
import { CheckoutService, type ServiceabilityResult } from "../../../lib/services/checkout.service"

export default function DeliveryCheck() {
  const [pincode, setPincode] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ServiceabilityResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const valid = /^\d{6}$/.test(pincode)

  const check = async () => {
    if (!valid) {
      setError("Enter a valid 6-digit pincode")
      return
    }
    setError(null)
    setResult(null)
    setLoading(true)
    try {
      setResult(await CheckoutService.checkServiceability(pincode))
    } catch {
      setError("Couldn't check delivery right now. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-4 shadow-card">
      <div className="flex items-center gap-2 mb-2.5">
        <MapPin size={15} className="text-secondary" />
        <h3 className="text-sm font-semibold text-text">Check delivery availability</h3>
      </div>
      <div className="flex gap-2">
        <input
          inputMode="numeric"
          maxLength={6}
          value={pincode}
          onChange={(e) => {
            setPincode(e.target.value.replace(/\D/g, ""))
            setResult(null)
            setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") check()
          }}
          placeholder="Enter 6-digit pincode"
          className="flex-1 border border-border rounded-xl px-3.5 py-2.5 text-sm bg-surface-2 text-text placeholder:text-faint focus:outline-none focus:border-primary"
        />
        <button
          onClick={check}
          disabled={!valid || loading}
          className="bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1.5"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Check
        </button>
      </div>
      {error ? <p className="text-xs text-primary mt-2">{error}</p> : null}
      {result ? (
        result.serviceable ? (
          <div className="mt-2.5 flex items-start gap-2 text-xs">
            <Check size={14} className="text-secondary flex-shrink-0 mt-0.5" />
            <span className="text-muted">
              Delivery available to {pincode}.
            </span>
          </div>
        ) : (
          <div className="mt-2.5 flex items-start gap-2 text-xs">
            <X size={14} className="text-primary flex-shrink-0 mt-0.5" />
            <span className="text-muted">Sorry, we don&apos;t deliver to {pincode} yet.</span>
          </div>
        )
      ) : null}
    </div>
  )
}
