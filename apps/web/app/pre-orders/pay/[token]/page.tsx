"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { CheckCircle2, Clock, Loader2 } from "lucide-react"
import { PreOrderService, type PreOrderSummary } from "../../../../lib/services/preorder.service"
import { openRazorpay } from "../../../../lib/openRazorpay"

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`

export default function BalancePayPage() {
  const params = useParams<{ token: string }>()
  const token = params?.token as string

  const [po, setPo] = useState<PreOrderSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)
  const [done, setDone] = useState(false)

  const load = async () => {
    try {
      const data = await PreOrderService.getByToken(token)
      setPo(data)
      if (data.status === "COMPLETED") setDone(true)
    } catch (e: any) {
      setError(e?.response?.data?.message || "This pre-order link is invalid or expired.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (token) load() }, [token])

  const pay = async () => {
    if (!po) return
    setPaying(true)
    try {
      const init = await PreOrderService.createBalancePayment(token)
      const result = await openRazorpay({
        keyId: init.keyId,
        amount: init.amount,
        currency: init.currency,
        razorpayOrderId: init.razorpayOrderId,
        description: `Balance payment — ${po.product.name}`,
      })
      if (!result) { setPaying(false); return }
      await PreOrderService.verifyBalance(token, result)
      setDone(true)
      toast.success("Payment complete 🎉")
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Payment failed")
      setPaying(false)
    }
  }

  if (loading) return <div className="max-w-md mx-auto px-4 py-20 text-center text-faint">Loading…</div>
  if (error) return <div className="max-w-md mx-auto px-4 py-20 text-center text-red-500 dark:text-red-400">{error}</div>
  if (!po) return null

  if (done) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-3">
        <CheckCircle2 size={40} className="text-green-500 dark:text-green-400 mx-auto" />
        <h1 className="text-xl font-bold text-text">Order confirmed</h1>
        <p className="text-muted text-sm">Thanks! We've received your balance payment for <strong>{po.product.name}</strong>. Your order is now being processed.</p>
        <a href="/account/orders" className="inline-block mt-2 text-primary font-medium">View my orders</a>
      </div>
    )
  }

  const expired = po.status === "EXPIRED"
  const payable = po.status === "AWAITING_BALANCE"

  return (
    <div className="max-w-md mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center gap-2 text-primary">
        <Clock size={18} />
        <h1 className="text-xl font-bold">Complete your pre-order</h1>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-4 flex gap-4">
        <img
          src={po.product.images?.[0]?.url || "/placeholder.png"}
          alt={po.product.name}
          className="w-20 h-20 object-contain rounded-xl border border-border"
        />
        <div className="flex-1 text-sm">
          <p className="font-semibold text-text">{po.product.name}</p>
          {po.variant && <p className="text-xs text-faint mt-0.5">{po.variant.name}</p>}
          <p className="text-muted mt-1">Qty {po.quantity}</p>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-4 space-y-2 text-sm">
        <div className="flex justify-between text-muted"><span>Order total</span><span>{inr(po.totalAmount)}</span></div>
        <div className="flex justify-between text-muted"><span>Booking paid</span><span>− {inr(po.bookingAmount)}</span></div>
        <div className="flex justify-between text-text font-bold border-t border-border pt-2 text-base"><span>Balance due</span><span>{inr(po.balanceAmount)}</span></div>
      </div>

      {expired ? (
        <p className="text-center text-red-500 dark:text-red-400 text-sm">This payment link has expired. Please contact support.</p>
      ) : (
        <button
          onClick={pay}
          disabled={paying || !payable}
          className="w-full bg-primary text-white py-3.5 rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {paying && <Loader2 size={16} className="animate-spin" />}
          {paying ? "Processing…" : `Pay ${inr(po.balanceAmount)}`}
        </button>
      )}
    </div>
  )
}
