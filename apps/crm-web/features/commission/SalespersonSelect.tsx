"use client"

import type { SalespersonOptionDto } from "@repo/crm-schema"
import { Field, Select } from "@/components/ui/Form"
import { useSalespersonOptions } from "./api"

interface Props {
  id: string
  value: string
  onChange: (salespersonId: string) => void
  /** The salesperson already on the sale, kept selectable even if they've since been deactivated. */
  current?: SalespersonOptionDto | null
  hint?: string
}

const label = (p: SalespersonOptionDto) => `${p.name} (${p.staffCode})`

/** Who made the sale, for commission. Hidden when no salespeople have been set up. */
export default function SalespersonSelect({ id, value, onChange, current, hint }: Props) {
  const { data } = useSalespersonOptions()
  const options: SalespersonOptionDto[] = [...(data ?? [])]
  if (current && !options.some((o) => o.id === current.id)) options.unshift(current)
  if (options.length === 0) return null
  return (
    <Field label="Salesperson" htmlFor={id} hint={hint}>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">No salesperson</option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {label(p)}
          </option>
        ))}
      </Select>
    </Field>
  )
}
