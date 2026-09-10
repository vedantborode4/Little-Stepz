"use client"

import { CreditCard, Shield, Wallet, AlertTriangle, Banknote } from "lucide-react"
import { useCheckoutStore } from "../../store/useCheckoutStore"
import {
  partialPlanSummary,
  forfeitureWarning,
  forfeitureAckLabel,
  partialReasonText,
  codPlanSummary,
  codReasonText,
} from "@repo/content/index"

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`

/**
 * How the customer pays: in full online, a deposit now with the balance at the door, or
 * Cash on Delivery for the whole amount.
 *
 * The quote comes from the store rather than a second fetch — CheckoutSummary already
 * asks the server, and two requests would be a chance for these options to disagree with
 * the summary. Unavailable options render greyed with a reason rather than disappearing:
 * an option that silently vanishes for one customer and not another is a reliable way to
 * generate support tickets.
 */
export default function PaymentSection() {
  const quote = useCheckoutStore((s) => s.quote)
  const paymentPlan = useCheckoutStore((s) => s.paymentPlan)
  const paymentMethod = useCheckoutStore((s) => s.paymentMethod)
  const setPaymentChoice = useCheckoutStore((s) => s.setPaymentChoice)
  const forfeitureAck = useCheckoutStore((s) => s.forfeitureAck)
  const setForfeitureAck = useCheckoutStore((s) => s.setForfeitureAck)

  const partial = quote?.partialPayment ?? null
  const cod = quote?.codPayment ?? null

  // The store falls back to paying in full the moment a quote withdraws an option, so these
  // only read true for something the server is currently offering.
  const codSelected = paymentMethod === "COD" && Boolean(cod?.eligible)
  const partialSelected = !codSelected && paymentPlan === "PARTIAL" && Boolean(partial?.eligible)
  const fullSelected = !codSelected && !partialSelected

  const cardClass = (active: boolean) =>
    `rounded-xl p-4 shadow-sm border transition ${
      active ? "border-primary bg-primary/5" : "border-border hover:bg-surface-2"
    }`

  return (
    <div className="space-y-3">
      {/* Pay in full online — always available. */}
      <button
        type="button"
        onClick={() => setPaymentChoice("FULL")}
        className={`w-full text-left flex items-center gap-4 ${cardClass(fullSelected)}`}
      >
        <div className="p-2 rounded-xl bg-primary/10">
          <CreditCard size={17} className="text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-text">Pay in full</p>
            <span className="text-[10px] font-bold bg-secondary/15 text-secondary px-2 py-0.5 rounded-full uppercase tracking-wide">
              Secure
            </span>
          </div>
          <p className="text-xs text-faint mt-0.5">
            Credit/Debit card, UPI, Net Banking or Wallet via Razorpay
          </p>
        </div>
        {quote ? <span className="text-sm font-semibold text-text">{inr(quote.total)}</span> : null}
      </button>

      {/* Pay a deposit now, the rest at the door. */}
      {partial ? (
        partial.eligible ? (
          <div className={cardClass(partialSelected)}>
            <button
              type="button"
              onClick={() => setPaymentChoice("PARTIAL")}
              className="w-full text-left flex items-center gap-4"
            >
              <div className="p-2 rounded-xl bg-primary/10">
                <Wallet size={17} className="text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-text">
                  Pay {partial.depositPercent}% now, rest on delivery
                </p>
                <p className="text-xs text-faint mt-0.5">
                  {partialPlanSummary(partial.depositAmount, partial.balanceAmount)}
                </p>
              </div>
              <span className="text-sm font-semibold text-primary">
                {inr(partial.depositAmount)}
              </span>
            </button>

            {partialSelected ? (
              <div className="mt-4 space-y-3 pl-1">
                {/* Always inline, never a tooltip or a "terms apply" link — the customer
                    must not reach the pay button without having seen it. */}
                <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2">
                  <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {forfeitureWarning(partial.depositAmount)}
                  </p>
                </div>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forfeitureAck}
                    onChange={(e) => setForfeitureAck(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded accent-primary"
                  />
                  <span className="text-xs text-muted">
                    {forfeitureAckLabel(partial.depositAmount)}
                  </span>
                </label>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex items-start gap-4 rounded-xl p-4 border border-border opacity-70">
            <div className="p-2 rounded-xl bg-surface-2">
              <Wallet size={17} className="text-faint" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-muted">
                Pay {partial.depositPercent}% now, rest on delivery
              </p>
              <p className="text-xs text-faint mt-0.5">
                {partialReasonText(
                  partial.reasons[0]?.code ?? "PARTIAL_PAYMENT_DISABLED",
                  partial.reasons[0]?.meta
                )}
              </p>
            </div>
          </div>
        )
      ) : null}

      {/* Cash on Delivery — the whole amount at the door. */}
      {cod ? (
        cod.eligible ? (
          <button
            type="button"
            onClick={() => setPaymentChoice("COD")}
            className={`w-full text-left flex items-center gap-4 ${cardClass(codSelected)}`}
          >
            <div className="p-2 rounded-xl bg-primary/10">
              <Banknote size={17} className="text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-text">Cash on Delivery</p>
              <p className="text-xs text-faint mt-0.5">{codPlanSummary(cod.amountDue)}</p>
            </div>
            <span className="text-sm font-semibold text-text">{inr(cod.amountDue)}</span>
          </button>
        ) : (
          <div className="flex items-start gap-4 rounded-xl p-4 border border-border opacity-70">
            <div className="p-2 rounded-xl bg-surface-2">
              <Banknote size={17} className="text-faint" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-muted">Cash on Delivery</p>
              <p className="text-xs text-faint mt-0.5">
                {codReasonText(cod.reasons[0]?.code ?? "COD_DISABLED", cod.reasons[0]?.meta)}
              </p>
            </div>
          </div>
        )
      ) : null}

      <div className="flex items-center pt-2 text-xs text-faint">
        <Shield size={13} className="text-secondary mr-1" />
        Click
        <span className="font-semibold text-muted mx-1">
          {codSelected ? "Place Order" : partialSelected ? "Pay & Place Order" : "Proceed to Pay"}
        </span>
        in the summary to continue.
      </div>
    </div>
  )
}
