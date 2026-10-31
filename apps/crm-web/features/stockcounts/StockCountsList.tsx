"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { STOCK_COUNT_STATUS_LABELS, STOCK_COUNT_STATUSES, type StockCountListItemDto, type StockCountStatus } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import DataTable from "@/components/ui/DataTable"
import { Badge, PageHeader, type BadgeTone } from "@/components/ui/Display"
import { Checkbox, Field, FormError, Select } from "@/components/ui/Form"
import Modal from "@/components/ui/Modal"
import { FilterSelect, ListToolbar, SearchInput } from "@/components/ui/Toolbar"
import { errorMessage } from "@/lib/api-error"
import { formatDate } from "@/lib/format"
import { useListState } from "@/lib/use-list-state"
import { useNamedList } from "../products/api"
import { useLocations } from "../settings/api"
import { useCreateStockCount, useStockCounts } from "./api"

const TONES: Record<StockCountStatus, BadgeTone> = {
  OPEN: "blue",
  SUBMITTED: "yellow",
  APPROVED: "green",
  CANCELLED: "gray",
  REVERSED: "gray",
}

export const CountStatusBadge = ({ status }: { status: StockCountStatus }) => (
  <Badge tone={TONES[status]}>{STOCK_COUNT_STATUS_LABELS[status]}</Badge>
)

function NewCountModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const create = useCreateStockCount()
  const locations = useLocations()
  const categories = useNamedList("categories")
  const [locationId, setLocationId] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [blind, setBlind] = useState(true)
  const [includeZero, setIncludeZero] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Modal
      title="Start a stock count"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={create.isPending}
            disabled={!locationId}
            onClick={async () => {
              setError(null)
              try {
                const count = await create.mutateAsync({ locationId, categoryId: categoryId || null, blind, includeZero })
                router.push(`/stock-counts/${count.id}`)
              } catch (err) {
                setError(errorMessage(err))
              }
            }}
          >
            Start counting
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={error} />
        <p className="text-sm text-muted">
          Counts sellable stock. The system&apos;s figures are taken now; avoid selling from this shelf until the count is entered.
        </p>
        <Field label="Location" htmlFor="sc-location" required>
          <Select id="sc-location" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">Choose…</option>
            {locations.data
              ?.filter((l) => l.isActive)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Category" htmlFor="sc-category" hint="Blank = everything with stock at the location">
          <Select id="sc-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">All categories</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Checkbox
          id="sc-blind"
          label="Blind count"
          description="Counters don't see what the system expects"
          checked={blind}
          onChange={(e) => setBlind(e.target.checked)}
        />
        <Checkbox
          id="sc-zero"
          label="Include items the system has at zero"
          checked={includeZero}
          onChange={(e) => setIncludeZero(e.target.checked)}
        />
      </div>
    </Modal>
  )
}

export default function StockCountsList() {
  const router = useRouter()
  const { state, update, params } = useListState<{ status?: StockCountStatus }>()
  const { data, isLoading } = useStockCounts(params)
  const [creating, setCreating] = useState(false)

  const columns: ColumnDef<StockCountListItemDto>[] = [
    { id: "code", header: "Count", cell: ({ row }) => <span className="font-mono text-xs text-primary">{row.original.code}</span> },
    { id: "date", header: "Started", cell: ({ row }) => formatDate(row.original.createdAt) },
    { id: "location", header: "Location", cell: ({ row }) => row.original.location.name },
    { id: "category", header: "Category", cell: ({ row }) => row.original.category?.name ?? <span className="text-faint">All</span> },
    {
      id: "progress",
      header: "Counted",
      meta: { align: "right", cellClassName: "tabular" },
      cell: ({ row }) => `${row.original.counted} / ${row.original.lineCount}`,
    },
    {
      id: "diff",
      header: "Differences",
      cell: ({ row }) =>
        row.original.unitsOver === undefined ? (
          <span className="text-faint">Hidden (blind)</span>
        ) : (
          <span className="tabular text-sm">
            <span className="text-green-600 dark:text-green-400">+{row.original.unitsOver}</span> /{" "}
            <span className="text-red-500">−{row.original.unitsShort}</span>
          </span>
        ),
    },
    { id: "status", header: "Status", cell: ({ row }) => <CountStatusBadge status={row.original.status} /> },
  ]

  return (
    <div>
      <PageHeader
        title="Stock Counts"
        subtitle="Count the shelves, review the differences, and post them as one adjustment once approved. Approved counts can be reversed."
        action={
          <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
            New count
          </Button>
        }
      />
      <ListToolbar>
        <SearchInput value={state.q} onChange={(q) => update({ q })} placeholder="Count number" />
        <FilterSelect
          label="Status"
          value={state.filters.status}
          onChange={(status) => update({ filters: { status: status as StockCountStatus | undefined } })}
        >
          <option value="">Any status</option>
          {STOCK_COUNT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STOCK_COUNT_STATUS_LABELS[s]}
            </option>
          ))}
        </FilterSelect>
      </ListToolbar>
      <DataTable
        columns={columns}
        data={data?.items}
        total={data?.total ?? 0}
        page={state.page}
        limit={state.limit}
        loading={isLoading}
        onPageChange={(page) => update({ page })}
        onRowClick={(c) => router.push(`/stock-counts/${c.id}`)}
        getRowId={(c) => c.id}
        emptyTitle="No stock counts yet"
        emptyHint="Start one per shelf, category or location."
        mobileCard={(c) => (
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">
                {c.code} · {c.location.name}
              </p>
              <p className="text-xs text-muted">
                {formatDate(c.createdAt)} · {c.counted}/{c.lineCount} counted
              </p>
            </div>
            <CountStatusBadge status={c.status} />
          </div>
        )}
      />
      {creating && <NewCountModal onClose={() => setCreating(false)} />}
    </div>
  )
}
