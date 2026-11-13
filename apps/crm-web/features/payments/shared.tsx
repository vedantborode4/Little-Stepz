"use client"

import { PAYMENT_STATUS_LABELS, type PaymentStatus } from "@repo/crm-schema"
import { Badge, type BadgeTone } from "@/components/ui/Display"
import { Select } from "@/components/ui/Form"
import LinkTabs from "@/components/ui/Tabs"
import { useCan } from "@/store/auth.store"
import { useReceivingAccounts } from "../settings/api"

const TONES: Record<PaymentStatus, BadgeTone> = { UNPAID: "red", PARTIAL: "yellow", PAID: "green", OVERPAID: "purple", REFUNDED: "gray" }

export const PaymentStatusBadge = ({ status }: { status: PaymentStatus }) => (
  <Badge tone={TONES[status]}>{PAYMENT_STATUS_LABELS[status]}</Badge>
)

export function PaymentTabs() {
  const can = useCan()
  return (
    <>
      <LinkTabs
        tabs={[
          { label: "Collections", href: "/payments", exact: true },
          { label: "Payments", href: "/payments/list" },
          { label: "Outstanding", href: "/payments/outstanding" },
          { label: "Advances", href: "/payments/advances" },
          ...(can("payments.transfer") ? [{ label: "Transfers", href: "/payments/transfers" }] : []),
        ]}
      />
      {!can("payments.view.all") && (
        <p className="-mt-3 mb-4 text-xs text-muted">You see the payments you recorded, and balances on orders you created.</p>
      )}
    </>
  )
}

/** Active receiving accounts, personal ones labelled so money lands where it should. */
export function AccountSelect({
  id,
  value,
  onChange,
  placeholder = "Choose account",
}: {
  id?: string
  value: string
  onChange: (id: string) => void
  placeholder?: string
}) {
  const accounts = useReceivingAccounts()
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {accounts.data
        ?.filter((a) => a.isActive)
        .map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
            {a.isPersonal ? " (personal)" : ""}
          </option>
        ))}
    </Select>
  )
}
