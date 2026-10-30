"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import {
  FULFILMENT_METHOD_LABELS,
  FULFILMENT_METHODS,
  SALES_CHANNEL_LABELS,
  SALES_CHANNELS,
  type FulfilmentMethod,
  type SalesChannel,
  type SalesOrderDetailDto,
  type SalesOrderType,
} from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import { Card, PageHeader, Skeleton } from "@/components/ui/Display"
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/Form"
import { errorMessage } from "@/lib/api-error"
import { todayIST } from "@/lib/format"
import { useCan } from "@/store/auth.store"
import { useLocations } from "../settings/api"
import { useSaveOrder } from "./api"
import CartLines, { CartTotals } from "./CartLines"
import CustomerSelect, { type ChosenCustomer } from "./CustomerSelect"
import SellableSearch from "./SellableSearch"
import { cartPayload, useCart } from "./use-cart"

interface Props {
  /** A draft being edited; omitted for a new order. */
  order?: SalesOrderDetailDto
  type?: SalesOrderType
}

function OrderEditor({ order, type, locations }: Props & { locations: { id: string; name: string }[] }) {
  const router = useRouter()
  const can = useCan()
  const save = useSaveOrder()
  const cart = useCart({
    customerId: order?.customer?.id ?? null,
    channel: order?.channel ?? "WHATSAPP",
    fulfilment: order?.fulfilment ?? ((type ?? "REGULAR") === "PRE_ORDER" ? "COUNTER" : "DELIVERY"),
    locationId: order?.location.id ?? locations[0]!.id,
    lines:
      order?.lines.map((l) => ({
        variantId: l.variantId,
        sku: l.sku,
        label: `${l.productName} — ${l.variantName}`,
        quantity: l.quantity,
        lineDiscount: Number(l.lineDiscount) > 0 ? l.lineDiscount : "",
        unitPrice: l.priceSource === "MANUAL" ? l.unitPrice : "",
      })) ?? [],
    orderDiscount: order && Number(order.totals.orderDiscount) > 0 ? order.totals.orderDiscount : "",
    shippingCharged: order && Number(order.totals.shippingCharged) > 0 ? order.totals.shippingCharged : "",
  })
  const [customer, setCustomer] = useState<ChosenCustomer | null>(order?.customer ? { ...order.customer, mobile: null } : null)
  const [orderDate, setOrderDate] = useState(order?.orderDate ?? todayIST())
  const [dueDate, setDueDate] = useState(order?.dueDate && order.dueDate !== order.orderDate ? order.dueDate : "")
  const [externalRef, setExternalRef] = useState(order?.externalRef ?? "")
  const [notes, setNotes] = useState(order?.notes ?? "")
  const [expectedArrival, setExpectedArrival] = useState(order?.expectedArrival ?? "")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<"draft" | "confirm" | null>(null)
  const c = cart.cart
  const orderType = order?.type ?? type ?? "REGULAR"

  const submit = async (confirm: boolean) => {
    setError(null)
    setSubmitting(confirm ? "confirm" : "draft")
    try {
      const saved = await save.mutateAsync({
        id: order?.id,
        input: {
          ...cartPayload(c),
          type: orderType,
          orderDate,
          dueDate: dueDate || undefined,
          expectedArrival: expectedArrival || undefined,
          externalRef: externalRef.trim() || null,
          notes: notes.trim() || null,
          confirm,
        },
      })
      toast.success(confirm ? `Order ${saved.code} confirmed` : `Draft ${saved.code} saved`)
      router.push(`/sales/${saved.id}`)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title={order ? `Edit ${order.code}` : orderType === "PRE_ORDER" ? "New pre-order" : "New order"}
        subtitle={
          orderType === "PRE_ORDER"
            ? "Sold before the stock arrives, at today's price. Take an advance now; stock is allocated when it lands and leaves at handover or dispatch."
            : "For delivery, wholesale and phone/WhatsApp orders. Confirming reserves the stock; it leaves stock at handover or dispatch."
        }
      />
      <FormError message={error} />
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4 sm:gap-5 items-start">
        <section className="bg-surface border border-border rounded-2xl">
          <div className="p-4 border-b border-border">
            <SellableSearch
              locationId={c.locationId}
              preOrder={orderType === "PRE_ORDER"}
              onPick={(item) =>
                cart.addItem({ variantId: item.variantId, sku: item.sku, label: `${item.productName} — ${item.variantName}` })
              }
            />
          </div>
          <CartLines cart={cart} canOverridePrice={can("sales.manage")} allowShort={orderType === "PRE_ORDER"} />
        </section>

        <aside className="space-y-4">
          <Card title="Customer & delivery">
            <div className="space-y-3">
              <CustomerSelect
                value={customer}
                emptyLabel="Choose customer"
                onChange={(chosen) => {
                  setCustomer(chosen)
                  cart.update({ customerId: chosen?.id ?? null })
                }}
              />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Channel" htmlFor="o-channel">
                  <Select id="o-channel" value={c.channel} onChange={(e) => cart.update({ channel: e.target.value as SalesChannel })}>
                    {SALES_CHANNELS.map((ch) => (
                      <option key={ch} value={ch}>
                        {SALES_CHANNEL_LABELS[ch]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Fulfilment" htmlFor="o-fulfilment">
                  <Select
                    id="o-fulfilment"
                    value={c.fulfilment}
                    onChange={(e) => cart.update({ fulfilment: e.target.value as FulfilmentMethod })}
                  >
                    {FULFILMENT_METHODS.map((f) => (
                      <option key={f} value={f}>
                        {FULFILMENT_METHOD_LABELS[f]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Stock from" htmlFor="o-location">
                  <Select id="o-location" value={c.locationId} onChange={(e) => cart.update({ locationId: e.target.value })}>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Order date" htmlFor="o-date">
                  <Input id="o-date" type="date" max={todayIST()} value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
                </Field>
                <Field label="Payment due" htmlFor="o-due" hint="Blank = customer's credit days">
                  <Input id="o-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </Field>
                {orderType === "PRE_ORDER" && (
                  <Field label="Expected arrival" htmlFor="o-arrival" className="col-span-2">
                    <Input id="o-arrival" type="date" value={expectedArrival} onChange={(e) => setExpectedArrival(e.target.value)} />
                  </Field>
                )}
                <Field label="Reference" htmlFor="o-ref" hint="e.g. website order no.">
                  <Input id="o-ref" value={externalRef} onChange={(e) => setExternalRef(e.target.value)} />
                </Field>
              </div>
            </div>
          </Card>

          <Card title="Totals">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Order discount (₹)" htmlFor="o-discount">
                  <Input
                    id="o-discount"
                    inputMode="decimal"
                    placeholder="0"
                    value={c.orderDiscount}
                    onChange={(e) => cart.update({ orderDiscount: e.target.value })}
                  />
                </Field>
                <Field label="Shipping charged (₹)" htmlFor="o-shipping">
                  <Input
                    id="o-shipping"
                    inputMode="decimal"
                    placeholder="0"
                    value={c.shippingCharged}
                    onChange={(e) => cart.update({ shippingCharged: e.target.value })}
                  />
                </Field>
              </div>
              <CartTotals cart={cart} />
              {cart.quoteError && <FormError message={errorMessage(cart.quoteError)} />}
              <Field label="Notes" htmlFor="o-notes">
                <Textarea id="o-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
              <div className="flex flex-wrap gap-2 justify-end">
                <Button
                  variant="secondary"
                  loading={submitting === "draft"}
                  disabled={submitting !== null || c.lines.length === 0}
                  onClick={() => submit(false)}
                >
                  Save draft
                </Button>
                <Button
                  loading={submitting === "confirm"}
                  disabled={submitting !== null || c.lines.length === 0}
                  onClick={() => submit(true)}
                >
                  Confirm order
                </Button>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  )
}

export default function OrderForm(props: Props) {
  const locations = useLocations()
  const active = (locations.data ?? []).filter((l) => l.isActive).sort((a, b) => (a.type === "STORE" ? -1 : b.type === "STORE" ? 1 : 0))
  if (locations.isLoading) return <Skeleton className="h-96 rounded-2xl" />
  if (active.length === 0) return <p className="text-sm text-muted">Add an active stock location in Settings first.</p>
  return <OrderEditor {...props} locations={active} />
}
