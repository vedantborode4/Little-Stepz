"use client"

import { Ban, PackageCheck, Pencil, Receipt, Undo2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { ALLOCATION_METHOD_LABELS, CHARGE_TYPE_LABELS, type PurchaseDetailDto } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import { Badge, Card, DetailRow, EmptyState, PageHeader, Skeleton } from "@/components/ui/Display"
import { formatDate, formatDateTime, formatMoney } from "@/lib/format"
import { useCan } from "@/store/auth.store"
import { StockDocumentModal } from "../inventory/StockModals"
import { usePurchase } from "./api"
import { CancelDialog, LateChargeModal, ReceiveDialog, ReturnModal } from "./PurchaseActions"
import { foreign, PurchaseStatusBadge } from "./shared"

type Dialog = "receive" | "cancel" | "late" | "return" | { documentId: string }

function th(label: string, right = false) {
  return (
    <th
      className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted whitespace-nowrap ${right ? "text-right" : "text-left"}`}
    >
      {label}
    </th>
  )
}

function PurchaseView({ p }: { p: PurchaseDetailDto }) {
  const can = useCan()
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const close = () => setDialog(null)
  const showCosts = p.totals !== undefined
  const isDraft = p.status === "DRAFT"
  const isReceived = p.status === "RECEIVED"

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title={`${p.code} · ${p.supplier.name}`}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <PurchaseStatusBadge status={p.status} />
            <span>
              Invoice {p.invoiceNumber ?? "—"} · {formatDate(p.invoiceDate)}
            </span>
          </span>
        }
        action={
          <>
            {isDraft && can("purchases.manage") && (
              <Link href={`/purchases/${p.id}/edit`}>
                <Button variant="secondary" icon={<Pencil size={15} />}>
                  Edit draft
                </Button>
              </Link>
            )}
            {isDraft && can("purchases.manage") && (
              <Button variant="ghost" icon={<Ban size={15} />} onClick={() => setDialog("cancel")}>
                Cancel
              </Button>
            )}
            {isDraft && can("purchases.receive") && (
              <Button icon={<PackageCheck size={16} />} onClick={() => setDialog("receive")}>
                Receive goods
              </Button>
            )}
            {isReceived && can("purchases.manage") && (
              <Button variant="secondary" icon={<Receipt size={15} />} onClick={() => setDialog("late")}>
                Late charge
              </Button>
            )}
            {isReceived && can("purchases.manage") && (
              <Button variant="secondary" icon={<Undo2 size={15} />} onClick={() => setDialog("return")}>
                Return to supplier
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 2xl:grid-cols-3 gap-4 sm:gap-5 items-start">
        <div className="2xl:col-span-2 space-y-4 sm:space-y-5">
          <section className="bg-surface border border-border rounded-2xl overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 border-b border-border">
              <h2 className="text-sm font-semibold">Items ({p.lines.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-2">
                  <tr>
                    {th("Item")}
                    {th("Qty", true)}
                    {showCosts && th(`Unit (${p.currency})`, true)}
                    {showCosts && th("Unit ₹", true)}
                    {showCosts && th("+ Charges", true)}
                    {showCosts && th("Landed / unit", true)}
                    {showCosts && th("Landed total", true)}
                  </tr>
                </thead>
                <tbody>
                  {p.lines.map((l) => (
                    <tr key={l.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        <p className="font-medium">
                          {l.productName} — {l.variantName}
                        </p>
                        <p className="text-xs font-mono text-faint">
                          {l.sku}
                          {l.returnedQty > 0 && <span className="ml-2 font-sans text-red-500">{l.returnedQty} returned</span>}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right tabular">{l.quantity}</td>
                      {showCosts && (
                        <td className="px-4 py-3 text-right tabular text-muted">{l.unitPrice ? foreign(l.unitPrice, p.currency) : "—"}</td>
                      )}
                      {showCosts && <td className="px-4 py-3 text-right tabular">{l.costs ? formatMoney(l.costs.unitPriceInr) : "—"}</td>}
                      {showCosts && (
                        <td className="px-4 py-3 text-right tabular text-muted">{l.costs ? formatMoney(l.costs.allocatedCharges) : "—"}</td>
                      )}
                      {showCosts && (
                        <td className="px-4 py-3 text-right tabular font-semibold">
                          {l.costs ? formatMoney(l.costs.landedUnitCost) : "—"}
                        </td>
                      )}
                      {showCosts && <td className="px-4 py-3 text-right tabular">{l.costs ? formatMoney(l.costs.landedTotal) : "—"}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {isDraft && showCosts && (
              <p className="px-4 sm:px-5 py-3 text-xs text-faint border-t border-border">
                Draft figures are a preview; they are frozen when the goods are received.
              </p>
            )}
          </section>

          {p.charges && (
            <Card title={`Charges (${p.charges.length})`}>
              {p.charges.length === 0 ? (
                <p className="text-sm text-muted">No charges on this purchase.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {p.charges.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                      <span className="font-medium">{CHARGE_TYPE_LABELS[c.type]}</span>
                      {c.description && <span className="text-muted">{c.description}</span>}
                      {c.isRecoverableTax && <Badge tone="blue">Input tax credit</Badge>}
                      <span className="flex-1" />
                      {c.currency !== "INR" && <span className="text-xs text-faint">{foreign(c.amount, c.currency)}</span>}
                      <span className="tabular font-semibold">{formatMoney(c.amountInr)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {p.costAdjustments && p.costAdjustments.length > 0 && (
            <Card title="Late charges">
              <ul className="divide-y divide-border">
                {p.costAdjustments.map((a) => {
                  const toInventory = a.lines.reduce((s, l) => s + Number(l.toInventory), 0)
                  const toCost = a.lines.reduce((s, l) => s + Number(l.toCostOfSales), 0)
                  return (
                    <li key={a.id} className="py-2 text-sm space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted">{a.code}</span>
                        <span className="font-medium">{CHARGE_TYPE_LABELS[a.type]}</span>
                        {a.description && <span className="text-muted">{a.description}</span>}
                        <span className="flex-1" />
                        <span className="tabular font-semibold">{formatMoney(a.amountInr)}</span>
                      </div>
                      <p className="text-xs text-muted">
                        {a.isRecoverableTax
                          ? "Recorded as input tax credit; stock cost unchanged."
                          : `${formatMoney(toInventory)} added to stock still on hand · ${formatMoney(toCost)} to cost of sales · split ${ALLOCATION_METHOD_LABELS[a.allocationMethod].toLowerCase()}`}
                        {" · "}
                        {formatDate(a.businessDate)} by {a.createdByName ?? "System"}
                      </p>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}

          {p.returns.length > 0 && (
            <Card title="Returns to supplier">
              <ul className="divide-y divide-border">
                {p.returns.map((r) => (
                  <li key={r.id} className="py-2 text-sm space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        className="font-mono text-xs text-primary hover:underline"
                        onClick={() => setDialog({ documentId: r.stockDocumentId })}
                      >
                        {r.code}
                      </button>
                      <span className="text-muted">{r.reason}</span>
                      <span className="flex-1" />
                      <span className="text-xs text-faint">
                        {formatDate(r.businessDate)} · {r.locationName}
                      </span>
                    </div>
                    <p className="text-xs text-muted">
                      {r.lines.map((l) => `${l.quantity} × ${l.productName} — ${l.variantName}`).join(", ")}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-4 sm:space-y-5">
          {showCosts && (
            <Card title="Landed cost">
              {p.totals ? (
                <dl>
                  <DetailRow label={`Goods (${p.currency})`}>{foreign(p.totals.goodsForeign, p.currency)}</DetailRow>
                  {p.exchangeRate && p.currency !== "INR" && (
                    <DetailRow label="Exchange rate">
                      ₹{p.exchangeRate} per {p.currency}
                    </DetailRow>
                  )}
                  <DetailRow label="Goods in ₹">{formatMoney(p.totals.goodsInr)}</DetailRow>
                  <DetailRow label="+ Charges added to cost">{formatMoney(p.totals.capitalisedCharges)}</DetailRow>
                  <DetailRow label="= Landed total">
                    <span className="text-base">{formatMoney(p.totals.landedTotal)}</span>
                  </DetailRow>
                  <DetailRow label="Input tax credit">{formatMoney(p.totals.inputTaxCredit)}</DetailRow>
                  <DetailRow label="Charges split">{ALLOCATION_METHOD_LABELS[p.allocationMethod]}</DetailRow>
                </dl>
              ) : (
                <p className="text-sm text-muted">Charges can&apos;t be split with the current data. Edit the draft.</p>
              )}
            </Card>
          )}
          <Card title="Details">
            <dl>
              <DetailRow label="Supplier">{p.supplier.name}</DetailRow>
              <DetailRow label="Shipment ref.">{p.shipmentRef ?? "—"}</DetailRow>
              <DetailRow label="Receive into">{p.location.name}</DetailRow>
              <DetailRow label="Created by">{p.createdByName ?? "—"}</DetailRow>
              {p.receivedAt && (
                <DetailRow label="Received">
                  {formatDate(p.receivedDate)} by {p.receivedByName ?? "—"}
                  <br />
                  <span className="text-xs text-faint">{formatDateTime(p.receivedAt)}</span>
                </DetailRow>
              )}
              {p.stockDocument && (
                <DetailRow label="Stock entry">
                  <button className="font-mono text-primary hover:underline" onClick={() => setDialog({ documentId: p.stockDocument!.id })}>
                    {p.stockDocument.code}
                  </button>
                </DetailRow>
              )}
            </dl>
            {p.notes && <p className="mt-3 text-sm text-muted whitespace-pre-line">{p.notes}</p>}
          </Card>
        </div>
      </div>

      {dialog === "receive" && <ReceiveDialog purchase={p} onClose={close} />}
      {dialog === "cancel" && <CancelDialog purchase={p} onClose={close} />}
      {dialog === "late" && <LateChargeModal purchase={p} onClose={close} />}
      {dialog === "return" && <ReturnModal purchase={p} onClose={close} />}
      {dialog && typeof dialog === "object" && (
        <StockDocumentModal documentId={dialog.documentId} onClose={close} onOpenDocument={(documentId) => setDialog({ documentId })} />
      )}
    </div>
  )
}

export default function PurchaseDetail({ id }: { id: string }) {
  const { data, isLoading } = usePurchase(id)
  if (isLoading) return <Skeleton className="h-96 rounded-2xl" />
  if (!data) return <EmptyState title="Purchase not found" />
  return <PurchaseView p={data} />
}
