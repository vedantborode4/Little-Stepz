"use client"

import { Ban, CheckCircle2, PackageCheck, Pencil, Printer, Send, Truck } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { FULFILMENT_METHOD_LABELS, SALES_CHANNEL_LABELS, SALES_ORDER_STATUS_LABELS, type SalesOrderDetailDto } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import ConfirmDialog from "@/components/ui/ConfirmDialog"
import { Card, DetailRow, EmptyState, PageHeader, Skeleton } from "@/components/ui/Display"
import { Field, Textarea } from "@/components/ui/Form"
import { errorMessage } from "@/lib/api-error"
import { formatDate, formatDateTime, formatMoney } from "@/lib/format"
import { useCan } from "@/store/auth.store"
import { StockDocumentModal } from "../inventory/StockModals"
import { useCancelOrder, useOrder, useOrderAction, type OrderAction } from "./api"
import { OrderStatusBadge, OrderTypeBadge, PriceSourceBadge } from "./shared"

const EVENT_LABELS: Record<string, string> = {
  created: "Created as draft",
  edited: "Draft edited",
  confirmed: "Confirmed — stock reserved",
  packed: "Packed",
  handed_over: "Handed over — stock deducted",
  dispatched: "Dispatched — stock deducted",
  sold_at_counter: "Sold at the counter — stock deducted",
  delivered: "Delivered",
  cancelled: "Cancelled",
}

const ACTION_COPY: Record<OrderAction, { label: string; done: string; confirm?: string }> = {
  confirm: { label: "Confirm order", done: "Order confirmed", confirm: "Confirming reserves the stock for this order." },
  pack: { label: "Mark packed", done: "Marked packed" },
  fulfil: { label: "", done: "Stock deducted", confirm: "The items leave stock now and the sale counts as revenue." },
  deliver: { label: "Mark delivered", done: "Marked delivered" },
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
  return (
    <ConfirmDialog
      title={`Cancel ${order.code}?`}
      message={
        <div className="space-y-3">
          <p>Any reserved stock is released. The order stays on record as cancelled.</p>
          <Field label="Reason" htmlFor="cancel-reason" required>
            <Textarea id="cancel-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
      }
      confirmLabel="Cancel order"
      confirmDisabled={!reason.trim()}
      loading={cancel.isPending}
      onCancel={onClose}
      onConfirm={async () => {
        try {
          await cancel.mutateAsync({ reason: reason.trim() })
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
  const [documentId, setDocumentId] = useState<string | null>(null)
  const delivery = o.fulfilment === "DELIVERY"
  const canShip = can("shipping.manage") || can("sales.manage")
  const open = o.status === "CONFIRMED" || o.status === "PACKED"
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
            {o.status === "CONFIRMED" && delivery && canShip && (
              <Button variant="secondary" icon={<PackageCheck size={15} />} loading={pending === "pack"} onClick={() => request("pack")}>
                Mark packed
              </Button>
            )}
            {open && (delivery ? canShip : can("sales.create")) && (
              <Button
                icon={delivery ? <Truck size={16} /> : <Send size={16} />}
                loading={pending === "fulfil"}
                onClick={() => request("fulfil")}
              >
                {fulfilLabel}
              </Button>
            )}
            {o.status === "DISPATCHED" && canShip && (
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
            {!o.fulfilledAt && o.status !== "CANCELLED" && can("sales.manage") && (
              <Button variant="ghost" icon={<Ban size={15} />} onClick={() => setCancelling(true)}>
                Cancel
              </Button>
            )}
          </>
        }
      />

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

          <Card title="Timeline">
            <ol className="space-y-3">
              {o.events.map((e) => (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                  <div>
                    <p className="font-medium">{EVENT_LABELS[e.action] ?? e.action}</p>
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
