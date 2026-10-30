"use client"

import { UserRound, X } from "lucide-react"
import { useState } from "react"
import { normalizeMobile, type CustomerType } from "@repo/crm-schema"
import { useCan } from "@/store/auth.store"
import CustomerForm from "../customers/CustomerForm"
import CustomerPicker from "../customers/CustomerPicker"
import { CustomerTypeBadge } from "../customers/shared"

export interface ChosenCustomer {
  id: string
  code: string
  name: string
  /** Unknown when reopening a saved order; the badge is then left out. */
  type?: CustomerType
  mobile: string | null
}

interface Props {
  value: ChosenCustomer | null
  onChange: (customer: ChosenCustomer | null) => void
  /** Label shown when nobody is chosen; walk-in sales need no customer. */
  emptyLabel?: string
}

/** Pick a customer by phone or name, or add one on the spot from what was typed. */
export default function CustomerSelect({ value, onChange, emptyLabel = "Walk-in customer" }: Props) {
  const can = useCan()
  const [creating, setCreating] = useState<{ name?: string; mobile?: string } | null>(null)

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border px-3 py-2">
        <UserRound size={16} className="text-faint shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{value.name}</p>
          <p className="text-xs text-faint">
            <span className="font-mono">{value.code}</span>
            {value.mobile && ` · ${value.mobile}`}
          </p>
        </div>
        {value.type && <CustomerTypeBadge type={value.type} />}
        <button type="button" aria-label="Remove customer" className="p-1 text-faint hover:text-text" onClick={() => onChange(null)}>
          <X size={16} />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <CustomerPicker
        placeholder={`${emptyLabel} — or search mobile / name`}
        onPick={(c) => onChange({ id: c.id, code: c.code, name: c.name, type: c.type, mobile: c.mobile })}
        onCreate={
          can("customers.manage") ? (typed) => setCreating(normalizeMobile(typed) ? { mobile: typed } : { name: typed }) : undefined
        }
      />
      {creating && (
        <CustomerForm
          initial={creating}
          onClose={() => setCreating(null)}
          onSaved={(c) => onChange({ id: c.id, code: c.code, name: c.name, type: c.type, mobile: c.mobile })}
        />
      )}
    </div>
  )
}
