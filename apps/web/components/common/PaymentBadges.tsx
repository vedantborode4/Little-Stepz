/**
 * Payment-method trust badges using the brand logo SVGs in /public/payments.
 * Each logo sits on a square light chip so the coloured marks stay legible on
 * the dark footer.
 */

const METHODS = [
  { label: "Visa", src: "/payments/visa.svg" },
  { label: "Mastercard", src: "/payments/mastercard.svg" },
  { label: "RuPay", src: "/payments/rupay.svg" },
  { label: "UPI", src: "/payments/upi.svg" },
]

export default function PaymentBadges({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {METHODS.map((m) => (
        <span
          key={m.label}
          title={m.label}
          className="inline-flex items-center justify-center h-8 min-w-12 px-2.5 bg-surface border border-border shadow-sm"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m.src} alt={m.label} className="h-5 w-auto max-w-13 object-contain" />
        </span>
      ))}
    </div>
  )
}
