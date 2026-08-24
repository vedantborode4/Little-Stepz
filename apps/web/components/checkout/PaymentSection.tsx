import { CreditCard, Shield } from "lucide-react"

/**
 * Online payment is the only method. This was a radio group until Cash on Delivery
 * was withdrawn; with a single option a choice control is noise, so the section
 * states what will happen instead of asking a question with one answer.
 */
export default function PaymentSection() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 border border-primary bg-primary/5 rounded-xl p-4 shadow-sm">
        <div className="p-2 rounded-xl bg-primary/10">
          <CreditCard size={17} className="text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-text">Pay Online</p>
            <span className="text-[10px] font-bold bg-secondary/15 text-secondary px-2 py-0.5 rounded-full uppercase tracking-wide">
              Secure
            </span>
          </div>
          <p className="text-xs text-faint mt-0.5">
            Credit/Debit card, UPI, Net Banking or Wallet via Razorpay
          </p>
        </div>
      </div>

      <div className="flex items-center pt-2 text-xs text-faint">
        <Shield size={13} className="text-secondary mr-1" />
        Click<span className="font-semibold text-muted mx-1">Proceed to Pay</span>in the summary to
        continue.
      </div>
    </div>
  )
}
