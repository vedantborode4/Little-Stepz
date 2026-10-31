"use client"

import type { ColumnDef } from "@tanstack/react-table"
import clsx from "clsx"
import { Plus } from "lucide-react"
import { useState } from "react"
import { SHIPMENT_STATUS_LABELS, type ShipmentListItemDto, type ShipmentStatus } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import DataTable from "@/components/ui/DataTable"
import { PageHeader, StatCard } from "@/components/ui/Display"
import Modal from "@/components/ui/Modal"
import { ExportMenu, FilterSelect, ListToolbar, SearchInput } from "@/components/ui/Toolbar"
import { downloadExport } from "@/lib/download"
import { formatDateTime, formatMoney } from "@/lib/format"
import { useListState } from "@/lib/use-list-state"
import { useCan } from "@/store/auth.store"
import OrderPicker from "../sales/OrderPicker"
import { useCouriers, useShipments, useShipmentSummary } from "./api"
import ShipmentPanel, { CreateShipmentModal, ShipmentStatusBadge } from "./ShipmentPanel"

type View = "open" | ShipmentStatus | "all"
type Filters = { courierId?: string }

const VIEWS: { key: View; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "PENDING", label: "To pack" },
  { key: "PACKED", label: "Packed" },
  { key: "DISPATCHED", label: "Dispatched" },
  { key: "IN_TRANSIT", label: "In transit" },
  { key: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  { key: "RTO", label: "RTO" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "all", label: "All" },
]

export default function ShippingBoard() {
  const [view, setView] = useState<View>("open")
  const { state, update, params } = useListState<Filters>()
  const query = { ...params, ...(view === "open" ? { open: "true" } : view === "all" ? {} : { status: view }) }
  const { data, isLoading } = useShipments(query)
  const summary = useShipmentSummary()
  const couriers = useCouriers(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [shipFor, setShipFor] = useState<{ id: string; code: string } | null>(null)
  const can = useCan()
  const c = summary.data?.counts

  const columns: ColumnDef<ShipmentListItemDto>[] = [
    { id: "code", header: "Shipment", cell: ({ row }) => <span className="font-mono text-xs text-primary">{row.original.code}</span> },
    { id: "order", header: "Order", cell: ({ row }) => <span className="font-mono text-xs">{row.original.order.code}</span> },
    { id: "customer", header: "Customer", cell: ({ row }) => row.original.customer?.name ?? "—" },
    { id: "courier", header: "Courier", cell: ({ row }) => row.original.courier?.name ?? <span className="text-faint">—</span> },
    { id: "awb", header: "AWB", meta: { cellClassName: "font-mono text-xs" }, cell: ({ row }) => row.original.awbs.join(", ") || "—" },
    { id: "status", header: "Status", cell: ({ row }) => <ShipmentStatusBadge status={row.original.status} /> },
    {
      id: "cost",
      header: "Cost / charged",
      meta: { align: "right", cellClassName: "tabular whitespace-nowrap" },
      cell: ({ row }) => (
        <span className={Number(row.original.courierCost) > Number(row.original.chargedToCustomer) ? "text-red-500" : ""}>
          {formatMoney(row.original.courierCost)} / {formatMoney(row.original.chargedToCustomer)}
        </span>
      ),
    },
    { id: "dispatched", header: "Dispatched", meta: { defaultHidden: true }, cell: ({ row }) => formatDateTime(row.original.dispatchedAt) },
  ]

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title="Shipping"
        subtitle="Delivery orders from packing to doorstep. Status is updated by hand from the courier's tracking; dispatching takes stock out."
        action={
          can("shipping.manage") && (
            <Button icon={<Plus size={16} />} onClick={() => setPicking(true)}>
              New shipment
            </Button>
          )
        }
      />
      {summary.data && c && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <StatCard title="Need a shipment" value={summary.data.awaitingShipment} hint="Confirmed delivery orders" />
          <StatCard
            title="To pack / packed"
            value={`${c.PENDING} / ${c.PACKED}`}
            color="bg-yellow-50 dark:bg-yellow-500/15 text-yellow-600"
          />
          <StatCard
            title="On the way"
            value={c.DISPATCHED + c.IN_TRANSIT + c.OUT_FOR_DELIVERY}
            hint={`${c.OUT_FOR_DELIVERY} out for delivery`}
            color="bg-purple-50 dark:bg-purple-500/15 text-purple-600"
          />
          <StatCard title="Coming back (RTO)" value={c.RTO} color="bg-red-50 dark:bg-red-500/15 text-red-500" />
          <StatCard
            title="Courier cost vs charged"
            value={<span className="text-lg">{formatMoney(summary.data.courierCost)}</span>}
            hint={`Charged to customers ${formatMoney(summary.data.chargedToCustomer)}`}
          />
        </div>
      )}
      <div>
        <div className="flex gap-1 overflow-x-auto scrollbar-none border-b border-border mb-3">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => {
                setView(v.key)
                update({ page: 1 })
              }}
              className={clsx(
                "px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
                view === v.key ? "border-primary text-primary" : "border-transparent text-muted hover:text-text",
              )}
            >
              {v.label}
              {c && v.key !== "open" && v.key !== "all" && <span className="ml-1 text-xs text-faint">{c[v.key]}</span>}
            </button>
          ))}
        </div>
        <ListToolbar actions={<ExportMenu onExport={(format) => downloadExport("/shipments", query, format)} />}>
          <SearchInput value={state.q} onChange={(q) => update({ q })} placeholder="Shipment, order, customer or AWB" />
          <FilterSelect label="Courier" value={state.filters.courierId} onChange={(courierId) => update({ filters: { courierId } })}>
            <option value="">All couriers</option>
            {couriers.data?.map((co) => (
              <option key={co.id} value={co.id}>
                {co.name}
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
          onRowClick={(s) => setOpenId(s.id)}
          getRowId={(s) => s.id}
          emptyTitle={
            view === "open" ? "Nothing on the way" : `No shipments ${SHIPMENT_STATUS_LABELS[view as ShipmentStatus]?.toLowerCase() ?? ""}`
          }
          emptyHint="Create a shipment from a confirmed delivery order."
          mobileCard={(s) => (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{s.customer?.name ?? "—"}</p>
                <p className="text-xs text-muted">
                  <span className="font-mono">{s.order.code}</span> · {s.courier?.name ?? "No courier"} · {s.awbs[0] ?? "No AWB"}
                </p>
              </div>
              <ShipmentStatusBadge status={s.status} />
            </div>
          )}
        />
      </div>
      {openId && (
        <Modal title="Shipment" onClose={() => setOpenId(null)} width="max-w-xl">
          <ShipmentPanel id={openId} showOrder />
        </Modal>
      )}
      {picking && (
        <OrderPicker
          readyFor="shipment"
          title="New shipment"
          hint="Confirmed delivery orders that don't have a shipment yet."
          empty="Every confirmed delivery order already has a shipment."
          onClose={() => setPicking(false)}
          onPick={(order) => {
            setPicking(false)
            setShipFor({ id: order.id, code: order.code })
          }}
        />
      )}
      {shipFor && <CreateShipmentModal orderId={shipFor.id} orderCode={shipFor.code} onClose={() => setShipFor(null)} />}
    </div>
  )
}
