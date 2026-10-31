"use client"

import { Ban, CheckCircle2, PackageCheck, Pencil, Printer, Send, Truck, Undo2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { FULFILMENT_METHOD_LABELS, SALES_CHANNEL_LABELS, SALES_ORDER_STATUS_LABELS, type SalesOrderDetailDto } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import ConfirmDialog from "@/components/ui/ConfirmDialog"
import { Card, DetailRow, EmptyState, PageHeader, Skeleton } from "@/components/ui/Display"
import { Field, Input, Textarea } from "@/components/ui/Form"
import Modal from "@/components/ui/Modal"
import { errorMessage } from "@/lib/api-error"
import { formatDate, formatDateTime, formatMoney } from "@/lib/format"
import { useCan } from "@/store/auth.store"
import { StockDocumentModal } from "../inventory/StockModals"
import OrderPaymentsCard from "../payments/OrderPayments"
import ReturnModal from "../returns/ReturnModal"
import ShipmentPanel, { CreateShipmentModal } from "../shipping/ShipmentPanel"
import { RefundBadge, ReturnDetailModal } from "../returns/ReturnsList"
import { AccountSelect } from "../payments/shared"
import { useCancelOrder, useDeallocate, useExpectedArrival, useOrder, useOrderAction, type OrderAction } from "./api"
import { OrderStatusBadge, OrderTypeBadge, PriceSourceBadge } from "./shared"

const EVENT_LABELS: Record<string, string> = {
  created: "Created as draft",
  edited: "Draft edited",
  confirmed: "Confirmed — stock reserved",
  packed: "Packed",
  handed_over: "Handed over — stock deducted",
  dispatched: "Dispatched — stock deducted",
  sold_at_counter: "Sold at the counter — stock deducted",
  imported: "Past sale imported — stock not changed",
  delivered: "Delivered",
  cancelled: "Cancelled",
  allocated: "Stock allocated",
  deallocated: "Allocation released",
  rescheduled: "Expected date changed",
  returned: "Items returned",
  shipment_rto: "Shipment coming back (RTO)",
  shipment_returned: "Shipment back with us",
  shipment_cancelled: "Shipment cancelled",
}

const eventLabel = (action: string, preOrder: boolean) =>
  action === "confirmed" && preOrder ? "Confirmed — waiting for stock" : (EVENT_LABELS[action] ?? action)

const ACTION_COPY: Record<OrderAction, { label: string; done: string; confirm?: string }> = {
  confirm: { label: "Confirm order", done: "Order confirmed", confirm: "Confirming reserves the stock for this order." },
  pack: { label: "Mark packed", done: "Marked packed" },
  fulfil: { label: "", done: "Stock deducted", confirm: "The items leave stock now and the sale counts as revenue." },
  deliver: { label: "Mark delivered", done: "Marked delivered" },
  allocate: { label: "Allocate stock", done: "Stock allocated", confirm: "Reserves the items for this pre-order from stock on hand." },
}

function ReleaseDialog({ order, onClose }: { order: SalesOrderDetailDto; onClose: () => void }) {
  const release = useDeallocate(order.id)
  const [reason, setReason] = useState("")
  return (
    <ConfirmDialog
      title={`Release ${order.code}'s stock?`}
      message={
        <div className="space-y-3">
          <p>The units become free again and the pre-order goes back to waiting. Use it to serve a more urgent order first.</p>
          <Field label="Reason" htmlFor="release-reason" required>
            <Textarea id="release-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
      }
      confirmLabel="Release"
      confirmDisabled={!reason.trim()}
      loading={release.isPending}
      onCancel={onClose}
      onConfirm={async () => {
        try {
          await release.mutateAsync(reason.trim())
          toast.success("Allocation released")
          onClose()
        } catch (err) {
          toast.error(errorMessage(err))
        }
      }}
    />
  )
}

function ArrivalModal({ order, onClose }: { order: SalesOrderDetailDto; onClose: () => void }) {
  const save = useExpectedArrival(order.id)
  const [date, setDate] = useState(order.expectedArrival ?? "")
  return (
    <Modal
      title="Expected arrival"
      onClose={onClose}
      width="max-w-sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={save.isPending}
            onClick={async () => {
              try {
                await save.mutateAsync(date || null)
                toast.success("Expected date updated")
                onClose()
              } catch (err) {
                toast.error(errorMessage(err))
              }
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <Field label="When the stock is expected" htmlFor="arrival-date">
        <Input id="arrival-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
    </Modal>
  )
}

function th(label: string, right = false) {
  return (
    <th
      className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted whitespace-nowrap ${right ? "text-right" : "text-left"}`}
    >
      {label}
    </th>
  )
}

function CancelDialog({ order, onClose }: { order: SalesOrderDetailDto; onClose: () => void }) {
  const cancel = useCancelOrder(order.id)
  const [reason, setReason] = useState("")
  const paid = Number(order.paid) > 0
  const [mode, setMode] = useState<"CREDIT" | "REFUND">(order.customer ? "CREDIT" : "REFUND")
  const [accountId, setAccountId] = useState("")
  const [reference, setReference] = useState("")
  const settlementReady = !paid || mode === "CREDIT" || accountId !== ""
  return (
    <ConfirmDialog
      title={`Cancel ${order.code}?`}
      message={
        <div className="space-y-3">
          <p>Any reserved stock is released. The order stays on record as cancelled.</p>
          {paid && (
            <div className="space-y-2 rounded-xl border border-border p-3">
              <p className="font-medium">{formatMoney(order.paid)} has been paid. What happens to it?</p>
              {order.customer && (
                <label className="flex items-center gap-2">
                  <input type="radio" name="settle" checked={mode === "CREDIT"} onChange={() => setMode("CREDIT")} />
                  Keep as {order.customer.name}&apos;s credit
                </label>
              )}
              <label className="flex items-center gap-2">
                <input type="radio" name="settle" checked={mode === "REFUND"} onChange={() => setMode("REFUND")} />
                Refund the money
              </label>
              {mode === "REFUND" && (
                <div className="grid grid-cols-2 gap-2">
                  <AccountSelect value={accountId} onChange={setAccountId} placeholder="Refund from…" />
                  <Input
                    aria-label="Refund reference"
                    placeholder="Reference"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}
          <Field label="Reason" htmlFor="cancel-reason" required>
            <Textarea id="cancel-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
      }
      confirmLabel="Cancel order"
      confirmDisabled={!reason.trim() || !settlementReady}
      loading={cancel.isPending}
      onCancel={onClose}
      onConfirm={async () => {
        try {
          await cancel.mutateAsync({
            reason: reason.trim(),
            settlement: !paid ? undefined : mode === "CREDIT" ? { mode } : { mode, accountId, reference: reference || null },
          })
          toast.success("Order cancelled")
          onClose()
        } catch (err) {
          toast.error(errorMessage(err))
        }
      }}
    />
  )
}

function OrderView({ o }: { o: SalesOrderDetailDto }) {
  const can = useCan()
  const run = useOrderAction(o.id)
  const [pending, setPending] = useState<OrderAction | null>(null)
  const [confirming, setConfirming] = useState<OrderAction | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [releasing, setReleasing] = useState(false)
  const [rescheduling, setRescheduling] = useState(false)
  const [returning, setReturning] = useState(false)
  const [openReturn, setOpenReturn] = useState<string | null>(null)
  const [shipping, setShipping] = useState(false)
  // A delivery order with a shipment moves through the shipment, so its own buttons step aside.
  const tracked = o.activeShipment !== null
  const returnable = o.fulfilledAt !== null && o.lines.some((l) => l.quantity > l.returnedQty)
  const [documentId, setDocumentId] = useState<string | null>(null)
  const delivery = o.fulfilment === "DELIVERY"
  const canShip = can("shipping.manage") || can("sales.manage")
  const preOrder = o.type === "PRE_ORDER"
  const awaitingStock = preOrder && o.status === "CONFIRMED" && !o.allocated
  const open = (o.status === "CONFIRMED" || o.status === "PACKED") && !awaitingStock
  const fulfilLabel = delivery ? "Dispatch" : "Hand over"
  const showCosts = o.profit !== undefined

  const act = async (action: OrderAction) => {
    setPending(action)
    try {
      await run.mutateAsync(action)
      toast.success(ACTION_COPY[action].done)
      setConfirming(null)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setPending(null)
    }
  }
  const request = (action: OrderAction) => (ACTION_COPY[action].confirm ? setConfirming(action) : act(action))

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title={`${o.code} · ${o.customer?.name ?? "Walk-in"}`}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={o.status} />
            <OrderTypeBadge type={o.type} />
            <span>
              {SALES_CHANNEL_LABELS[o.channel]} · {FULFILMENT_METHOD_LABELS[o.fulfilment]} · {formatDate(o.orderDate)}
            </span>
          </span>
        }
        action={
          <>
            {o.status === "DRAFT" && can("sales.create") && (
              <Link href={`/sales/${o.id}/edit`}>
                <Button variant="secondary" icon={<Pencil size={15} />}>
                  Edit draft
                </Button>
              </Link>
            )}
            {o.status === "DRAFT" && can("sales.create") && (
              <Button icon={<CheckCircle2 size={16} />} loading={pending === "confirm"} onClick={() => request("confirm")}>
                Confirm
              </Button>
            )}
            {awaitingStock && (can("sales.create") || can("inventory.move")) && (
              <Button icon={<PackageCheck size={16} />} loading={pending === "allocate"} onClick={() => request("allocate")}>
                Allocate stock
              </Button>
            )}
            {preOrder && o.allocated && o.status === "CONFIRMED" && can("sales.manage") && (
              <Button variant="ghost" onClick={() => setReleasing(true)}>
                Release stock
              </Button>
            )}
            {o.status === "CONFIRMED" && !awaitingStock && delivery && !tracked && canShip && (
              <Button variant="secondary" icon={<PackageCheck size={15} />} loading={pending === "pack"} onClick={() => request("pack")}>
                Mark packed
              </Button>
            )}
            {open && !(delivery && tracked) && (delivery ? canShip : can("sales.create")) && (
              <Button
                icon={delivery ? <Truck size={16} /> : <Send size={16} />}
                loading={pending === "fulfil"}
                onClick={() => request("fulfil")}
              >
                {fulfilLabel}
              </Button>
            )}
            {o.status === "DISPATCHED" && !tracked && canShip && (
              <Button icon={<CheckCircle2 size={16} />} loading={pending === "deliver"} onClick={() => request("deliver")}>
                Mark delivered
              </Button>
            )}
            {o.status !== "DRAFT" && o.status !== "CANCELLED" && (
              <Link href={`/sales/${o.id}/receipt`}>
                <Button variant="secondary" icon={<Printer size={15} />}>
                  Receipt
                </Button>
              </Link>
            )}
            {returnable && can("sales.manage") && (
              <Button variant="secondary" icon={<Undo2 size={15} />} onClick={() => setReturning(true)}>
                Return items
              </Button>
            )}
            {!o.fulfilledAt && o.status !== "CANCELLED" && can("sales.manage") && (
              <Button variant="ghost" icon={<Ban size={15} />} onClick={() => setCancelling(true)}>
                Cancel
              </Button>
            )}
          </>
        }
      />

      {preOrder && !o.fulfilledAt && o.status !== "CANCELLED" && o.status !== "DRAFT" && (
        <div
          className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${awaitingStock ? "border-yellow-300/60 bg-yellow-50 dark:bg-yellow-500/10" : "border-border bg-surface-2"}`}
        >
          <span className="font-medium">{awaitingStock ? "Waiting for stock" : "Stock allocated — ready to hand over or ship"}</span>
          <span className="text-muted">Expected {o.expectedArrival ? formatDate(o.expectedArrival) : "date not set"}</span>
          {can("sales.create") && (
            <Button size="sm" variant="ghost" onClick={() => setRescheduling(true)}>
              Change date
            </Button>
          )}
          <span className="flex-1" />
          <span className="text-muted">
            Advance {formatMoney(o.paid)} · balance {formatMoney(o.due)}
          </span>
        </div>
      )}

      {o.status === "CANCELLED" && (
        <div className="rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm">
          Cancelled {formatDateTime(o.cancelledAt)}: {o.cancelReason}
        </div>
      )}

      <div className="grid grid-cols-1 2xl:grid-cols-3 gap-4 sm:gap-5 items-start">
        <div className="2xl:col-span-2 space-y-4 sm:space-y-5">
          <section className="bg-surface border border-border rounded-2xl overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 border-b border-border">
              <h2 className="text-sm font-semibold">Items ({o.lines.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-2">
                  <tr>
                    {th("Item")}
                    {th("Qty", true)}
                    {th("Price", true)}
                    {th("Discount", true)}
                    {th("Total", true)}
                    {th("GST", true)}
                    {showCosts && th("Cost", true)}
                  </tr>
                </thead>
                <tbody>
                  {o.lines.map((l) => {
                    const discount = Number(l.lineDiscount) + Number(l.orderDiscountShare)
                    return (
                      <tr key={l.id} className="border-t border-border align-top">
                        <td className="px-4 py-3">
                          <p className="font-medium">
                            {l.productName} — {l.variantName}
                          </p>
                          <p className="text-xs text-faint flex flex-wrap items-center gap-2 mt-0.5">
                            <span className="font-mono">{l.sku}</span>
                            <PriceSourceBadge source={l.priceSource} />
                            {l.returnedQty > 0 && <span className="text-red-500">{l.returnedQty} returned</span>}
                            {l.reservedQty > 0 && <span className="text-blue-600 dark:text-blue-400">{l.reservedQty} reserved</span>}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right tabular">{l.quantity}</td>
                        <td className="px-4 py-3 text-right tabular">
                          {formatMoney(l.unitPrice)}
                          {Number(l.unitPrice) < Number(l.regularPrice) && (
                            <span className="block text-xs text-faint line-through">{formatMoney(l.regularPrice)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular text-muted">{discount > 0 ? `−${formatMoney(discount)}` : "—"}</td>
                        <td className="px-4 py-3 text-right tabular font-semibold">{formatMoney(l.lineTotal)}</td>
                        <td className="px-4 py-3 text-right tabular text-muted">
                          {formatMoney(l.gstAmount)}
                          <span className="block text-xs text-faint">{l.gstRate}%</span>
                        </td>
                        {showCosts && (
                          <td className="px-4 py-3 text-right tabular text-muted">
                            {l.cogs === null ? "—" : formatMoney(l.cogs)}
                            {(l.unknownCostQty ?? 0) > 0 && (
                              <span className="block text-xs text-yellow-600">{l.unknownCostQty} unknown</span>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {delivery && o.status !== "DRAFT" && o.status !== "CANCELLED" && (can("shipping.manage") || tracked) && (
            <Card title="Shipment">
              {o.activeShipment ? (
                <ShipmentPanel id={o.activeShipment.id} />
              ) : ["CONFIRMED", "PACKED", "DISPATCHED"].includes(o.status) ? (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm text-muted flex-1">
                    {awaitingStock ? "Allocate stock first, then ship." : "Book a courier and add the AWB to track this order to the door."}
                  </p>
                  <Button size="sm" icon={<Truck size={14} />} disabled={awaitingStock} onClick={() => setShipping(true)}>
                    Create shipment
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted">No open shipment.</p>
              )}
            </Card>
          )}

          <OrderPaymentsCard order={o} />

          {o.returns.length > 0 && (
            <Card title={`Returns · ${formatMoney(o.returned)}`}>
              <ul className="divide-y divide-border -my-2">
                {o.returns.map((r) => (
                  <li key={r.id}>
                    <button
                      className="w-full flex flex-wrap items-center gap-2 py-2 text-sm font-normal text-left hover:text-primary"
                      onClick={() => setOpenReturn(r.id)}
                    >
                      <span className="font-mono text-xs">{r.code}</span>
                      <span className="text-muted">{formatDate(r.businessDate)}</span>
                      <span className="text-muted truncate">{r.reason}</span>
                      <span className="flex-1" />
                      <RefundBadge r={r} />
                      <span className="tabular font-medium">{formatMoney(r.amount)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-4 sm:space-y-5">
          <Card title="Totals">
            <dl>
              <DetailRow label="Subtotal">{formatMoney(o.totals.subtotal)}</DetailRow>
              {Number(o.totals.lineDiscounts) > 0 && <DetailRow label="Item discounts">−{formatMoney(o.totals.lineDiscounts)}</DetailRow>}
              {Number(o.totals.orderDiscount) > 0 && <DetailRow label="Order discount">−{formatMoney(o.totals.orderDiscount)}</DetailRow>}
              {Number(o.totals.shippingCharged) > 0 && <DetailRow label="Shipping">{formatMoney(o.totals.shippingCharged)}</DetailRow>}
              <DetailRow label="Total (incl. GST)">
                <span className="text-base">{formatMoney(o.totals.grandTotal)}</span>
              </DetailRow>
              <DetailRow label="Taxable value">{formatMoney(o.totals.taxableTotal)}</DetailRow>
              <DetailRow label={o.isInterState ? "IGST" : "GST (CGST + SGST)"}>{formatMoney(o.totals.gstTotal)}</DetailRow>
            </dl>
          </Card>

          {showCosts && (
            <Card title="Profit">
              {o.profit ? (
                <dl>
                  <DetailRow label="Net sales (excl. GST)">{formatMoney(o.profit.netSales)}</DetailRow>
                  <DetailRow label="Cost of goods">{formatMoney(o.profit.cogs)}</DetailRow>
                  <DetailRow label="Gross profit">
                    <span className="text-base">{formatMoney(o.profit.grossProfit)}</span>
                    {o.profit.marginPercent && <span className="block text-xs text-muted">{o.profit.marginPercent}% margin</span>}
                  </DetailRow>
                  <DetailRow label="Before GST (price − cost)">{formatMoney(o.profit.profitBeforeGst)}</DetailRow>
                  {o.profit.unknownCostUnits > 0 && (
                    <p className="mt-2 text-xs text-yellow-700 dark:text-yellow-400">
                      {o.profit.unknownCostUnits} unit(s) had no known cost and are left out of these figures.
                    </p>
                  )}
                </dl>
              ) : (
                <p className="text-sm text-muted">Profit is fixed when the stock leaves ({fulfilLabel.toLowerCase()}).</p>
              )}
            </Card>
          )}

          <Card title="Details">
            <dl>
              <DetailRow label="Customer">
                {o.customer ? (
                  <Link href={`/customers/${o.customer.id}`} className="text-primary hover:underline">
                    {o.customer.name} ({o.customer.code})
                  </Link>
                ) : (
                  "Walk-in"
                )}
              </DetailRow>
              <DetailRow label="Stock from">{o.location.name}</DetailRow>
              <DetailRow label="Payment due">{formatDate(o.dueDate)}</DetailRow>
              {o.externalRef && <DetailRow label="Reference">{o.externalRef}</DetailRow>}
              <DetailRow label="Status">{SALES_ORDER_STATUS_LABELS[o.status]}</DetailRow>
              {o.fulfilledAt && <DetailRow label="Revenue date">{formatDate(o.fulfilledDate)}</DetailRow>}
              {o.importBatch && (
                <DetailRow label="Imported from">
                  <Link href={`/imports/${o.importBatch.id}`} className="font-mono text-primary hover:underline">
                    {o.importBatch.code}
                  </Link>
                </DetailRow>
              )}
              {o.stockDocument && (
                <DetailRow label="Stock entry">
                  <button className="font-mono text-primary hover:underline" onClick={() => setDocumentId(o.stockDocument!.id)}>
                    {o.stockDocument.code}
                  </button>
                </DetailRow>
              )}
              <DetailRow label="Created by">{o.createdByName ?? "—"}</DetailRow>
            </dl>
            {o.notes && <p className="mt-3 text-sm text-muted whitespace-pre-line">{o.notes}</p>}
          </Card>
          <Card title="Timeline">
            <ol className="space-y-3">
              {o.events.map((e) => (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                  <div>
                    <p className="font-medium">{eventLabel(e.action, preOrder)}</p>
                    <p className="text-xs text-muted">
                      {formatDateTime(e.createdAt)} · {e.userName ?? "System"}
                      {e.note && ` · ${e.note}`}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          title={confirming === "fulfil" ? `${fulfilLabel} ${o.code}?` : `${ACTION_COPY[confirming].label}?`}
          message={ACTION_COPY[confirming].confirm}
          confirmLabel={confirming === "fulfil" ? fulfilLabel : ACTION_COPY[confirming].label}
          tone="primary"
          loading={pending === confirming}
          onCancel={() => setConfirming(null)}
          onConfirm={() => act(confirming)}
        />
      )}
      {cancelling && <CancelDialog order={o} onClose={() => setCancelling(false)} />}
      {releasing && <ReleaseDialog order={o} onClose={() => setReleasing(false)} />}
      {shipping && <CreateShipmentModal orderId={o.id} orderCode={o.code} onClose={() => setShipping(false)} />}
      {returning && <ReturnModal order={o} onClose={() => setReturning(false)} />}
      {openReturn && <ReturnDetailModal id={openReturn} onClose={() => setOpenReturn(null)} />}
      {rescheduling && <ArrivalModal order={o} onClose={() => setRescheduling(false)} />}
      {documentId && <StockDocumentModal documentId={documentId} onClose={() => setDocumentId(null)} onOpenDocument={setDocumentId} />}
    </div>
  )
}

export default function OrderDetail({ id }: { id: string }) {
  const { data, isLoading } = useOrder(id)
  if (isLoading) return <Skeleton className="h-96 rounded-2xl" />
  if (!data) return <EmptyState title="Order not found" />
  return <OrderView o={data} />
}
