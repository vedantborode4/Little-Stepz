/**
 * Payment-method trust badges. Inline SVG (no external assets/CDN) and theme-aware:
 * each mark sits on a light chip that stays legible in dark mode.
 */

function Chip({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <span
      title={label}
      aria-label={label}
      className="inline-flex items-center justify-center h-7 min-w-[44px] px-2 rounded-md bg-surface border border-border shadow-sm"
    >
      {children}
    </span>
  )
}

function Visa() {
  return (
    <svg viewBox="0 0 48 16" width="34" height="12" role="img" aria-hidden="true">
      <text x="0" y="13" fontFamily="Arial, Helvetica, sans-serif" fontWeight="700" fontStyle="italic" fontSize="15" fill="#1A1F71">
        VISA
      </text>
    </svg>
  )
}

function Mastercard() {
  return (
    <svg viewBox="0 0 40 24" width="28" height="17" role="img" aria-hidden="true">
      <circle cx="15" cy="12" r="9" fill="#EB001B" />
      <circle cx="25" cy="12" r="9" fill="#F79E1B" />
      <path d="M20 5.2a9 9 0 000 13.6 9 9 0 000-13.6z" fill="#FF5F00" />
    </svg>
  )
}

function Rupay() {
  return (
    <svg viewBox="0 0 56 16" width="38" height="12" role="img" aria-hidden="true">
      <text x="0" y="13" fontFamily="Arial, Helvetica, sans-serif" fontWeight="700" fontSize="13" fill="#097DC6">
        Ru
      </text>
      <text x="19" y="13" fontFamily="Arial, Helvetica, sans-serif" fontWeight="700" fontSize="13" fill="#5B9A1F">
        Pay
      </text>
    </svg>
  )
}

function Upi() {
  return (
    <svg viewBox="0 0 40 16" width="30" height="12" role="img" aria-hidden="true">
      <text x="0" y="13" fontFamily="Arial, Helvetica, sans-serif" fontWeight="700" fontSize="12" fill="#097939">
        UPI
      </text>
      <path d="M26 2l5 6-5 6z" fill="#097939" />
      <path d="M31 2l5 6-5 6z" fill="#ED752E" />
    </svg>
  )
}

export default function PaymentBadges({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      <Chip label="Visa"><Visa /></Chip>
      <Chip label="Mastercard"><Mastercard /></Chip>
      <Chip label="RuPay"><Rupay /></Chip>
      <Chip label="UPI"><Upi /></Chip>
    </div>
  )
}
