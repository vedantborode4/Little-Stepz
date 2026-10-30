"use client"

import clsx from "clsx"
import { ArrowLeft, Printer } from "lucide-react"
import Link from "next/link"
import { Fragment, useState } from "react"
import type { BusinessProfileDto, SalesOrderDetailDto } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import { EmptyState, Skeleton } from "@/components/ui/Display"
import { formatDate, formatDateTime, formatMoney } from "@/lib/format"
import { useBusinessProfile } from "../settings/api"
import { useOrder } from "./api"

type PaperSize = "thermal" | "a4"

/** Prints on white paper whatever the app theme, so colours are fixed here on purpose. */
function ReceiptBody({ o, business, size }: { o: SalesOrderDetailDto; business: BusinessProfileDto | null | undefined; size: PaperSize }) {
  const t = o.totals
  // Split in paise so CGST + SGST always equals the GST total, even when it's an odd number of paise.
  const gstPaise = Math.round(Number(t.gstTotal) * 100)
  const cgst = (Math.floor(gstPaise / 2) / 100).toFixed(2)
  const sgst = ((gstPaise - Math.floor(gstPaise / 2)) / 100).toFixed(2)
  const row = (label: React.ReactNode, value: React.ReactNode, strong = false) => (
    <div className={clsx("flex justify-between gap-3", strong && "font-bold text-[1.1em]")}>
      <span>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  )

  return (
    <div
      className={clsx(
        "bg-white text-black mx-auto shadow-card print:shadow-none",
        size === "thermal" ? "w-[80mm] p-3 text-[12px] leading-snug" : "w-full max-w-[190mm] p-8 text-sm",
      )}
    >
      <div className="text-center space-y-0.5">
        <p className={clsx("font-bold", size === "thermal" ? "text-base" : "text-xl")}>{business?.tradeName ?? "Little Stepz"}</p>
        {business && (
          <>
            <p>{business.addressLine}</p>
            <p>
              {business.city} {business.pincode}
            </p>
            {business.phone && <p>Ph: {business.phone}</p>}
            {business.gstin && <p>GSTIN: {business.gstin}</p>}
          </>
        )}
        <p className="pt-1 font-semibold uppercase tracking-wide">{o.fulfilledAt ? "Receipt" : "Order confirmation"}</p>
        <p className="text-[0.85em]">This is not a tax invoice</p>
      </div>

      <div className="my-2 border-t border-dashed border-black" />
      {row("Receipt no.", o.code)}
      {row("Date", formatDateTime(o.fulfilledAt ?? o.createdAt))}
      {row("Customer", o.customerName ?? "Walk-in")}
      <div className="my-2 border-t border-dashed border-black" />

      <div className="space-y-1.5">
        {o.lines.map((l) => {
          const discount = Number(l.lineDiscount) + Number(l.orderDiscountShare)
          return (
            <div key={l.id}>
              <p className="font-medium">
                {l.productName} — {l.variantName}
              </p>
              {row(`${l.quantity} × ${formatMoney(l.unitPrice)}`, formatMoney(Number(l.unitPrice) * l.quantity))}
              {discount > 0 && row("  Discount", `−${formatMoney(discount)}`)}
            </div>
          )
        })}
      </div>

      <div className="my-2 border-t border-dashed border-black" />
      {row("Subtotal", formatMoney(t.subtotal))}
      {Number(t.lineDiscounts) + Number(t.orderDiscount) > 0 &&
        row("Discounts", `−${formatMoney(Number(t.lineDiscounts) + Number(t.orderDiscount))}`)}
      {Number(t.shippingCharged) > 0 && row("Shipping", formatMoney(t.shippingCharged))}
      {row("Total", formatMoney(t.grandTotal), true)}
      <div className="mt-1 text-[0.85em]">
        {o.isInterState ? (
          row("Incl. IGST", formatMoney(t.gstTotal))
        ) : (
          <>
            {row("Incl. CGST", formatMoney(cgst))}
            {row("Incl. SGST", formatMoney(sgst))}
          </>
        )}
      </div>
      {Number(o.returned) > 0 && (
        <>
          <div className="my-2 border-t border-dashed border-black" />
          {row("Items returned", `−${formatMoney(o.returned)}`)}
          {row("Net value", formatMoney(Number(o.grandTotal) - Number(o.returned)), true)}
        </>
      )}
      {o.payments.length > 0 && (
        <>
          <div className="my-2 border-t border-dashed border-black" />
          {o.payments.map((p) => (
            <Fragment key={p.id}>
              {row(
                Number(p.amount) < 0
                  ? `Refunded · ${p.accountName ?? "credit"}`
                  : p.source === "CREDIT"
                    ? "Paid from credit"
                    : `Paid · ${p.accountName}`,
                formatMoney(p.amount),
              )}
            </Fragment>
          ))}
          {Number(o.due) > 0 && row("Balance due", formatMoney(o.due), true)}
        </>
      )}
      {o.type === "PRE_ORDER" && !o.fulfilledAt && o.expectedArrival && (
        <p className="mt-1 text-center text-[0.85em]">Expected around {formatDate(o.expectedArrival)}</p>
      )}
      <div className="my-2 border-t border-dashed border-black" />
      <p className="text-center">{business?.receiptFooter ?? "Thank you!"}</p>
    </div>
  )
}

export default function Receipt({ id }: { id: string }) {
  const order = useOrder(id)
  const business = useBusinessProfile()
  const [size, setSize] = useState<PaperSize>("thermal")

  if (order.isLoading) return <Skeleton className="h-96 rounded-2xl" />
  if (!order.data) return <EmptyState title="Order not found" />

  return (
    <div className="space-y-4">
      <style>{`@page { size: ${size === "thermal" ? "80mm auto" : "A4"}; margin: ${size === "thermal" ? "2mm" : "12mm"}; }`}</style>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link href={`/sales/${id}`}>
          <Button variant="ghost" icon={<ArrowLeft size={15} />}>
            Back to {order.data.code}
          </Button>
        </Link>
        <span className="flex-1" />
        <div className="inline-flex rounded-xl border border-border bg-surface overflow-hidden">
          {(["thermal", "a4"] as const).map((s, i) => (
            <button
              key={s}
              onClick={() => setSize(s)}
              className={clsx(
                "px-3 h-10 text-xs",
                i > 0 && "border-l border-border",
                size === s ? "bg-primary text-white" : "text-muted hover:bg-surface-2",
              )}
            >
              {s === "thermal" ? "80 mm thermal" : "A4"}
            </button>
          ))}
        </div>
        <Button icon={<Printer size={16} />} onClick={() => window.print()}>
          Print
        </Button>
      </div>
      <ReceiptBody o={order.data} business={business.data} size={size} />
    </div>
  )
}
