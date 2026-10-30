"use client"

import { CheckCircle2, Printer, RotateCcw, ShoppingCart } from "lucide-react"
import Link from "next/link"
import { useRef, useState } from "react"
import { SALES_CHANNEL_LABELS, SALES_CHANNELS, type SalesChannel, type SalesOrderDetailDto } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import { PageHeader, Skeleton } from "@/components/ui/Display"
import { Field, FormError, Input, Select } from "@/components/ui/Form"
import Modal from "@/components/ui/Modal"
import { errorMessage } from "@/lib/api-error"
import { formatMoney } from "@/lib/format"
import { useCan } from "@/store/auth.store"
import { useCustomerCredit } from "../payments/api"
import TenderEditor, { tenderBalance, type TenderLine } from "../payments/TenderEditor"
import { useLocations } from "../settings/api"
import { usePosSale } from "./api"
import CartLines, { CartTotals } from "./CartLines"
import CustomerSelect, { type ChosenCustomer } from "./CustomerSelect"
import SellableSearch from "./SellableSearch"
import { cartPayload, useCart, type Cart } from "./use-cart"

function CheckoutModal({
  cart,
  customerId,
  onClose,
  onDone,
}: {
  cart: Cart
  customerId: string | null
  onClose: () => void
  onDone: (sale: SalesOrderDetailDto) => void
}) {
  const can = useCan()
  const hasCustomer = customerId !== null
  const sale = usePosSale()
  const credit = useCustomerCredit(can("payments.view") ? customerId : null)
  const [creditAmount, setCreditAmount] = useState("")
  // One key per checkout attempt: resubmitting (double click, retry) returns the same sale.
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [tenders, setTenders] = useState<TenderLine[]>([])
  const [excessToCredit, setExcessToCredit] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const grandTotal = cart.quote?.totals.grandTotal ?? "0"
  // Credit is applied first, so the tender only has to cover what's left.
  const total = Math.max(Number(grandTotal) - Number(creditAmount || 0), 0).toFixed(2)
  const balance = tenderBalance(total, tenders)
  const available = Number(credit.data?.balance ?? 0)
  const ready =
    cart.quote !== null && !cart.stale && (balance === 0 || (balance > 0 && hasCustomer) || (balance < 0 && hasCustomer && excessToCredit))

  const complete = async () => {
    setError(null)
    try {
      onDone(
        await sale.mutateAsync({
          ...cartPayload(cart.cart),
          fulfilment: "COUNTER",
          idempotencyKey,
          payments: tenders
            .filter((t) => Number(t.amount) > 0)
            .map((t) => ({ accountId: t.accountId, amount: t.amount, reference: t.reference || null })),
          excessToCredit,
          creditAmount: creditAmount.trim() || "0",
        }),
      )
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Modal
      title="Complete sale"
      onClose={onClose}
      width="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={sale.isPending}>
            Back
          </Button>
          <Button onClick={complete} loading={sale.isPending} disabled={!ready}>
            Complete {formatMoney(grandTotal)}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={error} />
        <CartTotals cart={cart} />
        {available > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-border px-3 py-2">
            <div className="flex-1 text-sm">
              <p className="font-medium">Use customer credit</p>
              <p className="text-xs text-faint">{formatMoney(available)} available</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setCreditAmount(Math.min(available, Number(grandTotal)).toFixed(2))}>
              Use max
            </Button>
            <div className="w-28">
              <Input
                aria-label="Credit to use"
                inputMode="decimal"
                placeholder="0"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                className="py-1.5 text-right tabular"
              />
            </div>
          </div>
        )}
        <TenderEditor
          total={total}
          tenders={tenders}
          onChange={setTenders}
          hasCustomer={hasCustomer}
          excessToCredit={excessToCredit}
          onExcessToCredit={setExcessToCredit}
        />
      </div>
    </Modal>
  )
}

function SaleDone({ sale, onNext }: { sale: SalesOrderDetailDto; onNext: () => void }) {
  return (
    <div className="max-w-md mx-auto bg-surface border border-border rounded-2xl p-6 text-center space-y-4">
      <CheckCircle2 size={40} className="mx-auto text-green-500" />
      <div>
        <p className="text-lg font-semibold">Sale complete</p>
        <p className="text-sm text-muted">
          <span className="font-mono">{sale.code}</span> · {formatMoney(sale.totals.grandTotal)} · {sale.totals.units} items
        </p>
        {Number(sale.due) > 0 && (
          <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">{formatMoney(sale.due)} left on the customer&apos;s account</p>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href={`/sales/${sale.id}/receipt`}>
          <Button variant="secondary" icon={<Printer size={15} />}>
            Print receipt
          </Button>
        </Link>
        <Link href={`/sales/${sale.id}`}>
          <Button variant="ghost">View sale</Button>
        </Link>
        <Button icon={<RotateCcw size={15} />} onClick={onNext} autoFocus>
          New sale
        </Button>
      </div>
    </div>
  )
}

function Register({ locations }: { locations: { id: string; name: string }[] }) {
  const can = useCan()
  const search = useRef<HTMLInputElement>(null)
  const initial = {
    customerId: null,
    channel: "STORE" as SalesChannel,
    fulfilment: "COUNTER" as const,
    locationId: locations[0]!.id,
    lines: [],
    orderDiscount: "",
    shippingCharged: "",
  }
  const cart = useCart(initial)
  const [customer, setCustomer] = useState<ChosenCustomer | null>(null)
  const [checkingOut, setCheckingOut] = useState(false)
  const [done, setDone] = useState<SalesOrderDetailDto | null>(null)
  const c = cart.cart
  const short = cart.quote?.lines.some((l) => l.available < l.quantity) ?? false

  const next = () => {
    cart.reset({ locationId: c.locationId })
    setCustomer(null)
    setDone(null)
    setTimeout(() => search.current?.focus(), 0)
  }

  if (done) return <SaleDone sale={done} onNext={next} />

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4 sm:gap-5 items-start pb-20 xl:pb-0">
      <section className="bg-surface border border-border rounded-2xl">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <SellableSearch
              ref={search}
              autoFocus
              locationId={c.locationId}
              onPick={(item) =>
                cart.addItem({ variantId: item.variantId, sku: item.sku, label: `${item.productName} — ${item.variantName}` })
              }
            />
          </div>
          {locations.length > 1 && (
            <Select
              aria-label="Sell from"
              value={c.locationId}
              onChange={(e) => cart.update({ locationId: e.target.value })}
              className="sm:w-40"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          )}
        </div>
        <CartLines cart={cart} canOverridePrice={can("sales.manage")} />
      </section>

      <aside className="space-y-4 xl:sticky xl:top-6">
        <section className="bg-surface border border-border rounded-2xl p-4 space-y-3">
          <CustomerSelect
            value={customer}
            onChange={(chosen) => {
              setCustomer(chosen)
              cart.update({ customerId: chosen?.id ?? null })
            }}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Channel" htmlFor="pos-channel">
              <Select id="pos-channel" value={c.channel} onChange={(e) => cart.update({ channel: e.target.value as SalesChannel })}>
                {SALES_CHANNELS.map((ch) => (
                  <option key={ch} value={ch}>
                    {SALES_CHANNEL_LABELS[ch]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Bill discount (₹)" htmlFor="pos-discount">
              <Input
                id="pos-discount"
                inputMode="decimal"
                placeholder="0"
                value={c.orderDiscount}
                onChange={(e) => cart.update({ orderDiscount: e.target.value })}
              />
            </Field>
          </div>
        </section>

        <section className="bg-surface border border-border rounded-2xl p-4 space-y-4">
          <CartTotals cart={cart} />
          {cart.quoteError && <FormError message={errorMessage(cart.quoteError)} />}
          {short && <p className="text-xs text-red-500">Some items don&apos;t have enough free stock at this location.</p>}
          <Button
            className="w-full hidden xl:inline-flex"
            icon={<ShoppingCart size={16} />}
            disabled={c.lines.length === 0 || !cart.quote || short}
            onClick={() => setCheckingOut(true)}
          >
            Checkout {cart.quote ? formatMoney(cart.quote.totals.grandTotal) : ""}
          </Button>
        </section>
      </aside>

      <div className="xl:hidden fixed inset-x-0 bottom-[60px] lg:bottom-0 z-30 bg-surface border-t border-border p-3 print:hidden">
        <Button
          className="w-full"
          icon={<ShoppingCart size={16} />}
          disabled={c.lines.length === 0 || !cart.quote || short}
          onClick={() => setCheckingOut(true)}
        >
          Checkout {cart.quote ? formatMoney(cart.quote.totals.grandTotal) : ""}
        </Button>
      </div>

      {checkingOut && (
        <CheckoutModal
          cart={cart}
          customerId={customer?.id ?? null}
          onClose={() => setCheckingOut(false)}
          onDone={(sale) => {
            setCheckingOut(false)
            setDone(sale)
          }}
        />
      )}
    </div>
  )
}

export default function PosScreen() {
  const locations = useLocations()
  const active = (locations.data ?? []).filter((l) => l.isActive).sort((a, b) => (a.type === "STORE" ? -1 : b.type === "STORE" ? 1 : 0))
  return (
    <div>
      <PageHeader title="Point of Sale" subtitle="Walk-in and counter sales. Stock leaves the moment the sale is completed." />
      {locations.isLoading ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : active.length === 0 ? (
        <p className="text-sm text-muted">Add an active stock location in Settings first.</p>
      ) : (
        <Register locations={active} />
      )}
    </div>
  )
}
