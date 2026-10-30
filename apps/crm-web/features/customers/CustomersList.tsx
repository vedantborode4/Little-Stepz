"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { CUSTOMER_TYPE_LABELS, CUSTOMER_TYPES, type CustomerListItemDto, type CustomerType } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import DataTable from "@/components/ui/DataTable"
import { Badge, PageHeader } from "@/components/ui/Display"
import { Checkbox } from "@/components/ui/Form"
import { ExportMenu, FilterSelect, ListToolbar, SearchInput } from "@/components/ui/Toolbar"
import { errorMessage } from "@/lib/api-error"
import { downloadExport } from "@/lib/download"
import { formatMoney } from "@/lib/format"
import { useListState } from "@/lib/use-list-state"
import { useCan } from "@/store/auth.store"
import { useCustomers } from "./api"
import CustomerForm from "./CustomerForm"
import { creditTerms, CustomerTabs, CustomerTypeBadge } from "./shared"

type Filters = { type?: CustomerType; includeInactive?: boolean }

const dash = <span className="text-faint">—</span>

export default function CustomersList() {
  const router = useRouter()
  const can = useCan()
  const { state, update, params } = useListState<Filters>({ sort: "name:asc" })
  const { data, isLoading } = useCustomers(params)
  const [creating, setCreating] = useState(false)
  const f = state.filters

  const columns: ColumnDef<CustomerListItemDto>[] = [
    {
      id: "name",
      header: "Customer",
      meta: { sortKey: "name" },
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.name}</p>
          <p className="text-xs font-mono text-faint">{row.original.code}</p>
        </div>
      ),
    },
    {
      id: "mobile",
      header: "Mobile",
      meta: { cellClassName: "tabular whitespace-nowrap" },
      cell: ({ row }) => row.original.mobile ?? dash,
    },
    {
      id: "city",
      header: "City / PIN",
      meta: { sortKey: "city" },
      cell: ({ row }) => [row.original.city, row.original.pincode].filter(Boolean).join(" · ") || dash,
    },
    { id: "type", header: "Type", cell: ({ row }) => <CustomerTypeBadge type={row.original.type} /> },
    { id: "terms", header: "Credit terms", cell: ({ row }) => creditTerms(row.original, formatMoney) ?? dash },
    { id: "email", header: "Email", meta: { defaultHidden: true }, cell: ({ row }) => row.original.email ?? dash },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) =>
        row.original.mergedInto ? (
          <Badge tone="gray">Merged into {row.original.mergedInto.code}</Badge>
        ) : (
          <Badge tone={row.original.isActive ? "green" : "gray"}>{row.original.isActive ? "Active" : "Inactive"}</Badge>
        ),
    },
  ]

  const exportParams = { ...params, contacts: "masked" }

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Retail and wholesale customers. Contact details are masked; opening one is recorded in the audit log."
        action={
          can("customers.manage") && (
            <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
              Add customer
            </Button>
          )
        }
      />
      <CustomerTabs />
      <ListToolbar
        actions={
          <>
            <ExportMenu onExport={(format) => downloadExport("/customers", exportParams, format)} />
            {can("customers.export") && (
              <Button
                variant="ghost"
                size="sm"
                title="Excel export with full phone numbers and emails (recorded in the audit log)"
                onClick={() =>
                  downloadExport("/customers", { ...params, contacts: "full" }, "xlsx").catch((err) => toast.error(errorMessage(err)))
                }
              >
                With contacts
              </Button>
            )}
          </>
        }
      >
        <SearchInput value={state.q} onChange={(q) => update({ q })} placeholder="Mobile, last 4 digits, name, code or city" />
        <FilterSelect label="Type" value={f.type} onChange={(type) => update({ filters: { type: type as CustomerType | undefined } })}>
          <option value="">All types</option>
          {CUSTOMER_TYPES.map((t) => (
            <option key={t} value={t}>
              {CUSTOMER_TYPE_LABELS[t]}
            </option>
          ))}
        </FilterSelect>
        <Checkbox
          id="cust-inactive"
          label="Show inactive & merged"
          checked={Boolean(f.includeInactive)}
          onChange={(ev) => update({ filters: { includeInactive: ev.target.checked || undefined } })}
        />
      </ListToolbar>
      <DataTable
        columns={columns}
        data={data?.items}
        total={data?.total ?? 0}
        page={state.page}
        limit={state.limit}
        sort={state.sort}
        loading={isLoading}
        onPageChange={(page) => update({ page })}
        onSortChange={(sort) => update({ sort })}
        onRowClick={(c) => router.push(`/customers/${c.id}`)}
        getRowId={(c) => c.id}
        emptyTitle="No customers found"
        emptyHint="Walk-in sales don't need a customer. Add one for repeat, wholesale or delivery customers."
        mobileCard={(c) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{c.name}</p>
              <p className="text-xs text-muted">
                <span className="font-mono">{c.code}</span>
                {[c.mobile, c.city].filter(Boolean).map((v) => ` · ${v}`)}
              </p>
            </div>
            <CustomerTypeBadge type={c.type} />
          </div>
        )}
      />
      {creating && <CustomerForm onClose={() => setCreating(false)} onSaved={(c) => router.push(`/customers/${c.id}`)} />}
    </div>
  )
}
