"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Loader2, Truck, PackageCheck, Check, X, ExternalLink, Wallet, RefreshCw } from "lucide-react"
import AdminModal from "../../../../components/admin/AdminModal"
import {
  AdminReturnService,
  REFUND_CHANNEL_LABEL,
  type AdminReturnDetail,
} from "../../../../lib/services/admin-return.service"
import { RETURN_STATUS_LABEL, RETURN_STATUS_CLASS, type ReturnRefundRow } from "../../../../lib/services/return.service"
import { friendlyError } from "../../../../lib/errorMessages"

const money = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
const BTN = "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[13px] font-medium transition hover:opacity-90 disabled:opacity-50"
const when = (d: string | null) => (d ? new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : null)

export default function AdminReturnDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [r, setR] = useState<AdminReturnDetail | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [modal, setModal] = useState<"approve" | "reject" | "receive" | { settle: ReturnRefundRow } | null>(null)

  const load = () => AdminReturnService.get(id).then(setR).catch(() => router.push("/admin/returns"))
  useEffect(() => { load() }, [id])

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key)
    try {
      const next = await fn()
      toast.success(ok)
      // Pickup/receive/settle return the refreshed detail; approve/reject does not.
      if (next && typeof next === "object" && "items" in next && "preview" in next) setR(next as AdminReturnDetail)
      else await load()
      setModal(null)
    } catch (e) {
      toast.error(friendlyError(e, "Action failed"))
    } finally {
      setBusy(null)
    }
  }

  if (!r) return <div className="animate-pulse h-40 bg-surface-2 rounded-2xl" />

  const lineAmount = (orderItemId: string) => r.preview?.lines.find((l) => l.orderItemId === orderItemId)?.amount
  const images = r.media.filter((m) => m.type === "image")
  const video = r.media.find((m) => m.type === "video")

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-surface-2 text-muted"><ArrowLeft size={18} /></button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold text-text">Return for order #{r.orderId.slice(-8).toUpperCase()}</h1>
            <p className="text-xs text-muted">
              Requested {when(r.createdAt)} ·{" "}
              <Link href={`/admin/orders/${r.orderId}`} className="text-primary hover:underline">View order</Link>
            </p>
          </div>
        </div>
        <span className={`sm:ml-auto self-start text-xs px-3 py-1.5 rounded-full font-semibold ${RETURN_STATUS_CLASS[r.status]}`}>
          {RETURN_STATUS_LABEL[r.status]}
        </span>
      </div>

      {/* Actions for the current stage */}
      <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-text mb-3">Next step</h2>
        <div className="flex flex-wrap gap-2">
          {r.status === "PENDING" && (
            <>
              <button onClick={() => setModal("approve")} className={`${BTN} bg-green-500 text-white border-green-500`}><Check size={14} /> Approve</button>
              <button onClick={() => setModal("reject")} className={`${BTN} border-red-200 text-red-600 dark:border-red-500/30 dark:text-red-400`}><X size={14} /> Reject</button>
            </>
          )}
          {r.status === "APPROVED" && !r.pickupMode && (
            <>
              <button
                onClick={() => run("manual", () => AdminReturnService.schedulePickup(r.id, "MANUAL"), "Marked as arranged manually")}
                disabled={!!busy}
                className={`${BTN} border-border text-text`}
              >
                {busy === "manual" ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />} Arrange pickup manually
              </button>
              {r.pickupAvailable && (
                <button
                  onClick={() => run("rvp", () => AdminReturnService.schedulePickup(r.id, "DELHIVERY"), "Delhivery pickup booked")}
                  disabled={!!busy}
                  className={`${BTN} border-border text-text`}
                >
                  {busy === "rvp" ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />} Book Delhivery pickup
                </button>
              )}
            </>
          )}
          {r.status === "APPROVED" && (
            <button
              onClick={() => run("picked", () => AdminReturnService.markPickedUp(r.id), "Marked picked up")}
              disabled={!!busy}
              className={`${BTN} border-border text-text`}
            >
              {busy === "picked" && <Loader2 size={14} className="animate-spin" />} Mark picked up
            </button>
          )}
          {["APPROVED", "PICKED_UP"].includes(r.status) && (
            <button onClick={() => setModal("receive")} className={`${BTN} bg-primary text-white border-primary`}>
              <PackageCheck size={14} /> Receive &amp; inspect
            </button>
          )}
          {["REJECTED", "CANCELLED", "REFUNDED", "INSPECTION_FAILED"].includes(r.status) && (
            <p className="text-sm text-muted">This return is closed.</p>
          )}
          {r.status === "RECEIVED" && <p className="text-sm text-muted">Waiting for the refunds below to settle.</p>}
        </div>
        {r.pickupMode && (
          <p className="text-xs text-muted mt-3">
            Pickup: {r.pickupMode === "DELHIVERY" ? "Delhivery reverse pickup" : "arranged manually"}
            {r.pickupStatus ? ` · ${r.pickupStatus.toLowerCase().replace(/_/g, " ")}` : ""}
            {r.pickupAwb ? ` · AWB ${r.pickupAwb}` : ""}
            {r.pickupTrackingUrl && (
              <a href={r.pickupTrackingUrl} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 text-primary hover:underline">
                Track <ExternalLink size={11} />
              </a>
            )}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Items */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border"><h2 className="font-semibold text-text">Items</h2></div>
          <div className="divide-y divide-border">
            {r.items.map((i) => (
              <div key={i.id} className="flex items-center gap-3 p-4">
                <img src={i.image || "/placeholder.webp"} alt="" className="w-12 h-12 rounded-lg object-cover border border-border" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text truncate">{i.productName}</p>
                  <p className="text-xs text-muted">
                    {i.variantName ? `${i.variantName} · ` : ""}Returning {i.quantity} of {i.orderedQuantity} · ₹{i.unitPrice} each
                  </p>
                  {i.acceptedQuantity != null && (
                    <p className="text-xs text-muted">
                      Accepted {i.acceptedQuantity}{i.restocked ? " · restocked" : ""}
                    </p>
                  )}
                </div>
                <p className="text-sm font-semibold text-text">
                  {money(i.refundAmount ?? lineAmount(i.orderItemId) ?? 0)}
                </p>
              </div>
            ))}
          </div>
          <div className="p-4 bg-surface-2 text-sm space-y-1">
            {r.refundAmount != null ? (
              <>
                <Row label="Refund" value={money(r.refundAmount)} bold />
                {r.shippingRefund ? <Row label="Includes shipping" value={money(r.shippingRefund)} /> : null}
              </>
            ) : (
              <Row label="Estimated refund" value={money(r.estimatedRefund)} bold />
            )}
          </div>
        </div>

        {/* Request */}
        <div className="bg-surface border border-border rounded-2xl p-5 space-y-3 text-sm">
          <h2 className="font-semibold text-text">Request</h2>
          <Row label="Reason" value={r.reason} />
          {r.description && <p className="text-muted whitespace-pre-line">{r.description}</p>}
          <Row label="Customer" value={r.customer?.name ?? "—"} />
          <Row label="Phone" value={r.customer?.phone ?? r.address?.phone ?? "—"} />
          <Row label="Payment" value={r.order.paymentMethod === "COD" ? "Cash on delivery" : r.order.paymentPlan === "PARTIAL" ? "Deposit + balance" : "Online"} />
          {r.order.isPreOrder && <p className="text-xs text-amber-600">Converted pre-order</p>}
          {r.refundUpiId ? (
            <Row label="Refund UPI" value={r.refundUpiId} />
          ) : r.preview?.manualRefundLikely ? (
            <p className="text-xs text-amber-600">Paid partly in cash but no UPI on file — contact the customer before paying out.</p>
          ) : null}
          {r.address && (
            <p className="text-xs text-muted pt-2 border-t border-border">
              {r.address.name}, {r.address.address}, {r.address.city}, {r.address.state} {r.address.pincode}
            </p>
          )}
          {r.adminNote && <Row label="Admin note" value={r.adminNote} />}
          {r.inspectionNote && <Row label="Inspection" value={r.inspectionNote} />}
        </div>
      </div>

      {/* Evidence */}
      <div className="bg-surface border border-border rounded-2xl p-5">
        <h2 className="font-semibold text-text mb-3">Evidence</h2>
        {r.media.length === 0 ? (
          <p className="text-sm text-amber-600">No photos or video were attached (request came from an older app version).</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {images.map((m) => (
              <a key={m.publicId} href={m.url} target="_blank" rel="noopener noreferrer">
                <img src={m.url} alt="" className="w-28 h-28 rounded-xl object-cover border border-border hover:opacity-90" />
              </a>
            ))}
            {video && <video src={video.url} controls className="w-64 h-40 rounded-xl border border-border bg-black" />}
          </div>
        )}
      </div>

      {/* Refunds */}
      {r.refunds.length > 0 && (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border"><h2 className="font-semibold text-text">Refunds</h2></div>
          <div className="divide-y divide-border">
            {r.refunds.map((f) => (
              <div key={f.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-4 text-sm">
                <div className="flex-1">
                  <p className="font-medium text-text">{REFUND_CHANNEL_LABEL[f.channel]} · {money(f.amount)}</p>
                  <p className="text-xs text-muted">
                    {f.status.toLowerCase()}
                    {f.razorpayRefundId ? ` · ${f.razorpayRefundId}` : ""}
                    {f.manualReference ? ` · ref ${f.manualReference}` : ""}
                    {f.processedAt ? ` · ${when(f.processedAt)}` : ""}
                  </p>
                  {f.failureReason && <p className="text-xs text-red-500">{f.failureReason}</p>}
                </div>
                <div className="flex gap-2">
                  {f.status === "FAILED" && f.channel !== "MANUAL" && (
                    <button
                      onClick={() => {
                        if (!confirm("Check the Razorpay dashboard first: retry only if this payment shows NO refund for this amount. Retry now?")) return
                        void run(`retry-${f.id}`, () => AdminReturnService.retryRefund(f.id), "Refund retried")
                      }}
                      disabled={!!busy}
                      className={`${BTN} border-border text-text`}
                    >
                      {busy === `retry-${f.id}` ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Retry
                    </button>
                  )}
                  {f.status !== "PROCESSED" && (f.channel === "MANUAL" || f.status === "FAILED" || f.status === "INITIATED") && (
                    <button onClick={() => setModal({ settle: f })} className={`${BTN} border-border text-text`}>
                      <Wallet size={14} /> Mark {f.channel === "MANUAL" ? "paid" : "settled"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(modal === "approve" || modal === "reject") && (
        <ResolveModal
          approve={modal === "approve"}
          busy={busy === "resolve"}
          onClose={() => setModal(null)}
          onSubmit={(note) =>
            run("resolve", () => AdminReturnService.resolve(r.id, modal === "approve" ? "APPROVED" : "REJECTED", note), modal === "approve" ? "Return approved" : "Return rejected")
          }
        />
      )}
      {modal === "receive" && (
        <ReceiveModal r={r} busy={busy === "receive"} onClose={() => setModal(null)}
          onSubmit={(body) => run("receive", () => AdminReturnService.receive(r.id, body), "Return received")} />
      )}
      {modal && typeof modal === "object" && (
        <SettleModal row={modal.settle} upi={r.refundUpiId} busy={busy === "settle"} onClose={() => setModal(null)}
          onSubmit={(ref) => run("settle", () => AdminReturnService.settleRefund(modal.settle.id, ref), "Refund settled")} />
      )}

    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted shrink-0">{label}</span>
      <span className={`text-right break-all ${bold ? "font-bold text-text" : "text-text"}`}>{value}</span>
    </div>
  )
}

function ResolveModal({ approve, busy, onClose, onSubmit }: {
  approve: boolean; busy: boolean; onClose: () => void; onSubmit: (note?: string) => void
}) {
  const [note, setNote] = useState("")
  return (
    <AdminModal title={approve ? "Approve return" : "Reject return"} onClose={onClose}>
      <p className="text-sm text-muted mb-3">
        {approve
          ? "No money moves yet — the refund is released when you receive and inspect the items."
          : "The customer is notified with your note."}
      </p>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000}
        placeholder={approve ? "Optional note" : "Reason for rejection"}
        className="w-full border border-border bg-surface rounded-xl px-3 py-2.5 text-sm text-text mb-4 focus:outline-none focus:border-primary resize-none" />
      <button onClick={() => onSubmit(note.trim() || undefined)} disabled={busy || (!approve && !note.trim())}
        className={`w-full py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-60 ${approve ? "bg-green-500" : "bg-red-500"}`}>
        {busy ? "Saving…" : approve ? "Approve" : "Reject"}
      </button>
    </AdminModal>
  )
}

function ReceiveModal({ r, busy, onClose, onSubmit }: {
  r: AdminReturnDetail
  busy: boolean
  onClose: () => void
  onSubmit: (body: Parameters<typeof AdminReturnService.receive>[1]) => void
}) {
  const [items, setItems] = useState(r.items.map((i) => ({ returnItemId: i.id, acceptedQuantity: i.quantity, restock: true })))
  const [refundShipping, setRefundShipping] = useState(Boolean(r.preview?.shippingDefaultOn && r.preview.shippingRefundable > 0))
  const [override, setOverride] = useState("")
  const [note, setNote] = useState("")

  // An estimate only: the server computes the authoritative amount with the same rules.
  const estimate = Math.min(
    r.items.reduce((s, i, idx) => {
      const full = r.preview?.lines.find((l) => l.orderItemId === i.orderItemId)?.amount ?? 0
      return s + (i.quantity ? (full * items[idx]!.acceptedQuantity) / i.quantity : 0)
    }, 0) + (refundShipping ? r.preview?.shippingRefundable ?? 0 : 0),
    r.preview?.refundCapacity ?? Infinity
  )
  const allAccepted = items.every((d, idx) => d.acceptedQuantity === r.items[idx]!.quantity)
  const nothingAccepted = items.every((d) => d.acceptedQuantity === 0)
  const overrideValue = override.trim() === "" ? undefined : Number(override)
  const overrideInvalid = overrideValue !== undefined && (!Number.isFinite(overrideValue) || overrideValue < 0)

  const update = (idx: number, patch: Partial<(typeof items)[number]>) =>
    setItems((list) => list.map((d, i) => (i === idx ? { ...d, ...patch } : d)))

  return (
    <AdminModal title="Receive & inspect" onClose={onClose} width="max-w-xl">
      <div className="space-y-4">
        {r.items.map((i, idx) => (
          <div key={i.id} className="rounded-xl border border-border p-3 space-y-2">
            <p className="text-sm font-medium text-text">{i.productName}{i.variantName ? ` · ${i.variantName}` : ""}</p>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2 text-muted">
                Accepted
                <select value={items[idx]!.acceptedQuantity} onChange={(e) => update(idx, { acceptedQuantity: Number(e.target.value) })}
                  className="border border-border bg-surface rounded-lg px-2 py-1 text-text">
                  {Array.from({ length: i.quantity + 1 }, (_, n) => <option key={n} value={n}>{n} of {i.quantity}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 text-muted">
                <input type="checkbox" checked={items[idx]!.restock} onChange={(e) => update(idx, { restock: e.target.checked })} className="accent-primary" />
                Put back in stock
              </label>
            </div>
          </div>
        ))}

        {(r.preview?.shippingRefundable ?? 0) > 0 && (
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" checked={refundShipping} onChange={(e) => setRefundShipping(e.target.checked)} className="accent-primary mt-0.5" />
            <span>
              Refund shipping ({money(r.preview!.shippingRefundable)}) — only for seller error, and only applies if every unit of the order is accepted.
            </span>
          </label>
        )}

        <div className="rounded-xl bg-surface-2 p-3 text-sm space-y-2">
          <div className="flex justify-between"><span className="text-muted">Estimated refund</span><span className="font-bold text-text">{money(nothingAccepted ? 0 : estimate)}</span></div>
          {!nothingAccepted && (
            <label className="block text-xs text-muted">
              Refund a lower amount (optional, e.g. for missing accessories)
              <input value={override} onChange={(e) => setOverride(e.target.value)} inputMode="decimal" placeholder={`Leave blank for ${money(estimate)}`}
                className="mt-1 w-full border border-border bg-surface rounded-lg px-3 py-2 text-sm text-text" />
            </label>
          )}
          {nothingAccepted && <p className="text-xs text-red-500">Nothing accepted — the return closes as failed inspection with no refund.</p>}
          {!allAccepted && !nothingAccepted && <p className="text-xs text-muted">Units not accepted are neither refunded nor restocked.</p>}
        </div>

        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000}
          placeholder={nothingAccepted || overrideValue !== undefined ? "Inspection note (shown to the customer)" : "Inspection note (optional)"}
          className="w-full border border-border bg-surface rounded-xl px-3 py-2.5 text-sm text-text focus:outline-none focus:border-primary resize-none" />

        <button
          onClick={() => onSubmit({ items, refundShipping, refundAmount: overrideValue, inspectionNote: note.trim() || undefined })}
          disabled={busy || overrideInvalid || ((nothingAccepted || overrideValue !== undefined) && !note.trim())}
          className="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-primary disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {busy && <Loader2 size={15} className="animate-spin" />} Confirm receipt &amp; refund
        </button>
      </div>
    </AdminModal>
  )
}

function SettleModal({ row, upi, busy, onClose, onSubmit }: {
  row: ReturnRefundRow; upi: string | null; busy: boolean; onClose: () => void; onSubmit: (reference: string) => void
}) {
  const [ref, setRef] = useState("")
  return (
    <AdminModal title={row.channel === "MANUAL" ? "Record manual payout" : "Mark refund settled"} onClose={onClose}>
      <p className="text-sm text-muted mb-3">
        {row.channel === "MANUAL"
          ? `Pay ${money(row.amount)}${upi ? ` to ${upi}` : ""}, then enter the UPI transaction reference.`
          : `Only if you refunded ${money(row.amount)} directly in the Razorpay dashboard. Enter the refund id.`}
      </p>
      <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Reference"
        className="w-full border border-border bg-surface rounded-xl px-3 py-2.5 text-sm text-text mb-4" />
      <button onClick={() => onSubmit(ref.trim())} disabled={busy || ref.trim().length < 3}
        className="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-primary disabled:opacity-60">
        {busy ? "Saving…" : "Confirm"}
      </button>
    </AdminModal>
  )
}
