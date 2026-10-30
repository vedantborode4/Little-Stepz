"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { CalendarClock, PackageCheck, Plus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PRE_ORDER_STOCK_STATE_LABELS, PRE_ORDER_STOCK_STATES, type PreOrderRowDto, type PreOrderStockState } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import DataTable from "@/components/ui/DataTable"
import { Badge, Card, PageHeader, StatCard, type BadgeTone } from "@/components/ui/Display"
import { Checkbox } from "@/components/ui/Form"
import { FilterSelect, ListToolbar, SearchInput } from "@/components/ui/Toolbar"
import { errorMessage } from "@/lib/api-error"
import { formatDate, formatMoney } from "@/lib/format"
import { useListState } from "@/lib/use-list-state"
import { useCan } from "@/store/auth.store"
import { useAllocateAvailable, usePreOrders, usePreOrderSummary, useWaitingItems } from "./api"
import { OrderStatusBadge } from "./shared"

type Filters = { state?: PreOrderStockState; overdue?: boolean; includeClosed?: boolean }

const STATE_TONES: Record<PreOrderStockState, BadgeTone> = { AWAITING: "yellow", READY: "blue", ALLOCATED: "green" }

export const PreOrderStateBadge = ({ state }: { state: PreOrderStockState }) => (
  <Badge tone={STATE_TONES[state]}>{PRE_ORDER_STOCK_STATE_LABELS[state]}</Badge>
)

function WaitingItems({ canAllocate }: { canAllocate: boolean }) {
  const { data } = useWaitingItems()
  const allocate = useAllocateAvailable()
  if (!data?.length) return null

  const run = async (variantId?: string) => {
    try {
      const result = await allocate.mutateAsync(variantId)
      if (result.allocated.length) toast.success(`Allocated ${result.allocated.join(", ")}`)
      else toast.info("No pre-order can be fully covered from free stock yet")
      if (result.skipped.length) toast.warning(`Skipped (stock taken meanwhile): ${result.skipped.join(", ")}`)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Card
      title="Waiting by item"
      action={
        canAllocate && (
          <Button size="sm" icon={<PackageCheck size={14} />} loading={allocate.isPending} onClick={() => run()}>
            Allocate all ready
          </Button>
        )
      }
    >
      <ul className="divide-y divide-border -my-2">
        {data.map((w) => (
          <li key={w.variantId} className="flex flex-wrap items-center gap-3 py-2 text-sm">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {w.productName} — {w.variantName}
              </p>
              <p className="text-xs text-faint">
                <span className="font-mono">{w.sku}</span> · {w.preOrders} pre-order{w.preOrders === 1 ? "" : "s"}
              </p>
            </div>
            <span className="tabular text-muted">{w.awaitedUnits} awaited</span>
            <span className={`tabular font-medium ${w.available > 0 ? "text-green-600 dark:text-green-400" : "text-faint"}`}>
              {w.available} free now
            </span>
            {canAllocate && w.available > 0 && (
              <Button size="sm" variant="secondary" disabled={allocate.isPending} onClick={() => run(w.variantId)}>
                Allocate
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}

export default function PreOrdersBoard() {
  const router = useRouter()
  const can = useCan()
  const { state, update, params } = useListState<Filters>()
  const { data, isLoading } = usePreOrders(params)
  const summary = usePreOrderSummary()
  const canAllocate = can("sales.create") || can("inventory.move")
  const f = state.filters
  const s = summary.data

  const columns: ColumnDef<PreOrderRowDto>[] = [
    {
      id: "code",
      header: "Pre-order",
      cell: ({ row }) => (
        <div>
          <p className="font-mono text-xs text-primary">{row.original.code}</p>
          {row.original.queuePosition && <p className="text-[11px] text-faint">#{row.original.queuePosition} in queue</p>}
        </div>
      ),
    },
    { id: "customer", header: "Customer", cell: ({ row }) => row.original.customer?.name ?? "—" },
    { id: "items", header: "Items", meta: { cellClassName: "max-w-72 truncate" }, cell: ({ row }) => row.original.items },
    {
      id: "expected",
      header: "Expected",
      meta: { cellClassName: "whitespace-nowrap" },
      cell: ({ row }) => (
        <span className={row.original.overdue ? "text-red-500 font-medium" : ""}>
          {formatDate(row.original.expectedArrival)}
          {row.original.overdue && " · late"}
        </span>
      ),
    },
    {
      id: "total",
      header: "Total",
      meta: { align: "right", cellClassName: "tabular" },
      cell: ({ row }) => formatMoney(row.original.grandTotal),
    },
    {
      id: "paid",
      header: "Advance",
      meta: { align: "right", cellClassName: "tabular text-muted" },
      cell: ({ row }) => formatMoney(row.original.paid),
    },
    {
      id: "due",
      header: "Balance",
      meta: { align: "right", cellClassName: "tabular font-semibold" },
      cell: ({ row }) => formatMoney(row.original.due),
    },
    {
      id: "state",
      header: "Stock",
      cell: ({ row }) =>
        row.original.stockState ? (
          <PreOrderStateBadge state={row.original.stockState} />
        ) : (
          <OrderStatusBadge status={row.original.status} />
        ),
    },
  ]

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title="Pre-orders"
        subtitle="Sold before the stock arrives. Advances are held until handover; stock is allocated oldest first when it lands."
        action={
          can("sales.create") && (
            <Link href="/pre-orders/new">
              <Button icon={<Plus size={16} />}>New pre-order</Button>
            </Link>
          )
        }
      />
      {s && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <StatCard title="Open" value={s.open} hint={`${s.overdueArrivals} past expected date`} icon={<CalendarClock size={18} />} />
          <StatCard title="Awaiting stock" value={s.awaiting} color="bg-yellow-50 dark:bg-yellow-500/15 text-yellow-600" />
          <StatCard
            title="Ready to allocate"
            value={s.ready}
            hint="Free stock covers them"
            color="bg-blue-50 dark:bg-blue-500/15 text-blue-600"
          />
          <StatCard
            title="Allocated"
            value={s.allocated}
            hint="Ready to hand over or ship"
            color="bg-green-50 dark:bg-green-500/15 text-green-600"
          />
          <StatCard title="Advances held" value={formatMoney(s.advancesHeld)} hint="Not revenue until fulfilled" />
        </div>
      )}
      <WaitingItems canAllocate={canAllocate} />
      <div>
        <ListToolbar>
          <SearchInput value={state.q} onChange={(q) => update({ q })} placeholder="Pre-order, customer, item or SKU" />
          <FilterSelect
            label="Stock"
            value={f.state}
            onChange={(st) => update({ filters: { state: st as PreOrderStockState | undefined } })}
          >
            <option value="">Any stock state</option>
            {PRE_ORDER_STOCK_STATES.map((st) => (
              <option key={st} value={st}>
                {PRE_ORDER_STOCK_STATE_LABELS[st]}
              </option>
            ))}
          </FilterSelect>
          <Checkbox
            id="po-late"
            label="Late only"
            checked={Boolean(f.overdue)}
            onChange={(e) => update({ filters: { overdue: e.target.checked || undefined } })}
          />
          <Checkbox
            id="po-closed"
            label="Include fulfilled & cancelled"
            checked={Boolean(f.includeClosed)}
            onChange={(e) => update({ filters: { includeClosed: e.target.checked || undefined } })}
          />
        </ListToolbar>
        <DataTable
          columns={columns}
          data={data?.items}
          total={data?.total ?? 0}
          page={state.page}
          limit={state.limit}
          loading={isLoading}
          onPageChange={(page) => update({ page })}
          onRowClick={(o) => router.push(`/sales/${o.id}`)}
          getRowId={(o) => o.id}
          emptyTitle="No open pre-orders"
          emptyHint="Take a pre-order for items that haven't arrived yet, with an advance."
          mobileCard={(o) => (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{o.customer?.name ?? "—"}</p>
                <p className="text-xs text-muted truncate">{o.items}</p>
                <p className="text-xs text-faint">
                  <span className="font-mono">{o.code}</span> · expected {formatDate(o.expectedArrival)}
                </p>
              </div>
              <div className="text-right space-y-1">
                {o.stockState && <PreOrderStateBadge state={o.stockState} />}
                <p className="text-sm font-semibold tabular">{formatMoney(o.due)} due</p>
              </div>
            </div>
          )}
        />
      </div>
    </div>
  )
}
