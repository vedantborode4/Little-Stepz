"use client"

import { ExternalLink, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { SHIPMENT_STATUS_LABELS, type ShipmentDetailDto, type ShipmentStatus } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import { Badge, DetailRow, Skeleton, type BadgeTone } from "@/components/ui/Display"
import { Field, FormError, Input, Select } from "@/components/ui/Form"
import Modal from "@/components/ui/Modal"
import { errorMessage } from "@/lib/api-error"
import { formatDateTime, formatMoney } from "@/lib/format"
import { useCan } from "@/store/auth.store"
import { useAddPackage, useCouriers, useCreateShipment, useRemovePackage, useShipment, useShipmentStatus, useUpdateShipment } from "./api"

const TONES: Record<ShipmentStatus, BadgeTone> = {
  PENDING: "yellow",
  PACKED: "blue",
  DISPATCHED: "purple",
  IN_TRANSIT: "purple",
  OUT_FOR_DELIVERY: "purple",
  DELIVERED: "green",
  RTO: "red",
  RETURNED: "gray",
  CANCELLED: "gray",
}

export const ShipmentStatusBadge = ({ status }: { status: ShipmentStatus }) => (
  <Badge tone={TONES[status]}>{SHIPMENT_STATUS_LABELS[status]}</Badge>
)

/** Button wording for each move; dispatch is the one that takes stock out. */
const MOVE_LABELS: Record<ShipmentStatus, string> = {
  PENDING: "",
  PACKED: "Mark packed",
  DISPATCHED: "Dispatch",
  IN_TRANSIT: "In transit",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Mark delivered",
  RTO: "Coming back (RTO)",
  RETURNED: "Back with us",
  CANCELLED: "Cancel shipment",
}

function CourierSelect({ id, value, onChange }: { id?: string; value: string; onChange: (id: string) => void }) {
  const couriers = useCouriers()
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Choose courier…</option>
      {couriers.data?.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </Select>
  )
}

export function CreateShipmentModal({ orderId, orderCode, onClose }: { orderId: string; orderCode: string; onClose: () => void }) {
  const create = useCreateShipment()
  const [courierId, setCourierId] = useState("")
  const [awb, setAwb] = useState("")
  const [courierCost, setCourierCost] = useState("")
  const [error, setError] = useState<string | null>(null)
  return (
    <Modal
      title={`Ship ${orderCode}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={create.isPending}
            onClick={async () => {
              setError(null)
              try {
                await create.mutateAsync({
                  orderId,
                  courierId: courierId || null,
                  courierCost: courierCost.trim() || "0",
                  packages: awb.trim() ? [{ awb: awb.trim() }] : [],
                })
                toast.success("Shipment created")
                onClose()
              } catch (err) {
                setError(errorMessage(err))
              }
            }}
          >
            Create shipment
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={error} />
        <p className="text-sm text-muted">The courier and AWB can be added now or later; both are needed before dispatch.</p>
        <Field label="Courier" htmlFor="sh-courier">
          <CourierSelect id="sh-courier" value={courierId} onChange={setCourierId} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="AWB / tracking no." htmlFor="sh-awb">
            <Input id="sh-awb" value={awb} onChange={(e) => setAwb(e.target.value)} className="uppercase" />
          </Field>
          <Field label="Courier charge to us (₹)" htmlFor="sh-cost">
            <Input id="sh-cost" inputMode="decimal" placeholder="0" value={courierCost} onChange={(e) => setCourierCost(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  )
}

function EditModal({ s, onClose }: { s: ShipmentDetailDto; onClose: () => void }) {
  const update = useUpdateShipment(s.id)
  const [courierId, setCourierId] = useState(s.courier?.id ?? "")
  const [courierCost, setCourierCost] = useState(s.courierCost)
  const [notes, setNotes] = useState(s.notes ?? "")
  const canChangeCourier = s.status === "PENDING" || s.status === "PACKED"
  return (
    <Modal
      title={`Edit ${s.code}`}
      onClose={onClose}
      width="max-w-sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={update.isPending}
            onClick={async () => {
              try {
                await update.mutateAsync({ ...(canChangeCourier && { courierId: courierId || null }), courierCost, notes: notes || null })
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
      <div className="space-y-3">
        {canChangeCourier && (
          <Field label="Courier" htmlFor="ed-courier">
            <CourierSelect id="ed-courier" value={courierId} onChange={setCourierId} />
          </Field>
        )}
        <Field label="Courier charge to us (₹)" htmlFor="ed-cost" hint="Update when the courier's bill arrives">
          <Input id="ed-cost" inputMode="decimal" value={courierCost} onChange={(e) => setCourierCost(e.target.value)} />
        </Field>
        <Field label="Notes" htmlFor="ed-notes">
          <Input id="ed-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

/** Everything about one shipment: parcels and tracking links, the next allowed moves, and its history. */
export default function ShipmentPanel({ id, showOrder = false }: { id: string; showOrder?: boolean }) {
  const can = useCan()
  const { data: s } = useShipment(id)
  const move = useShipmentStatus(id)
  const add = useAddPackage(id)
  const remove = useRemovePackage(id)
  const [awb, setAwb] = useState("")
  const [note, setNote] = useState("")
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState<ShipmentStatus | null>(null)
  if (!s) return <Skeleton className="h-40 rounded-xl" />
  const manage = can("shipping.manage")
  const open = s.status === "PENDING" || s.status === "PACKED"

  const run = async (status: ShipmentStatus) => {
    setPending(status)
    try {
      await move.mutateAsync({ status, note: note.trim() || null })
      setNote("")
      toast.success(SHIPMENT_STATUS_LABELS[status])
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs">{s.code}</span>
        <ShipmentStatusBadge status={s.status} />
        {showOrder && (
          <Link href={`/sales/${s.order.id}`} className="text-xs text-primary hover:underline">
            Order {s.order.code}
          </Link>
        )}
        <span className="flex-1" />
        {manage && s.status !== "CANCELLED" && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>
      <dl>
        <DetailRow label="Courier">{s.courier?.name ?? <span className="text-yellow-700 dark:text-yellow-400">Not chosen</span>}</DetailRow>
        <DetailRow label="Deliver to">{[s.customer?.name, s.city, s.pincode].filter(Boolean).join(" · ") || "—"}</DetailRow>
        <DetailRow label="Courier charge / charged to customer">
          {formatMoney(s.courierCost)} / {formatMoney(s.chargedToCustomer)}
        </DetailRow>
      </dl>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">Parcels</p>
        {s.packages.length === 0 && <p className="text-sm text-muted">No AWB yet.</p>}
        <ul className="space-y-1">
          {s.packages.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-sm">
              <span className="font-mono">{p.awb}</span>
              {p.trackingUrl && (
                <a
                  href={p.trackingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Track <ExternalLink size={12} />
                </a>
              )}
              <span className="flex-1" />
              {manage && open && (
                <button
                  aria-label={`Remove ${p.awb}`}
                  className="p-1 text-faint hover:text-red-500"
                  onClick={() => remove.mutateAsync(p.id).catch((err) => toast.error(errorMessage(err)))}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
        {manage && open && (
          <div className="mt-2 flex gap-2">
            <Input
              aria-label="New AWB"
              placeholder="Add AWB"
              value={awb}
              onChange={(e) => setAwb(e.target.value)}
              className="py-1.5 uppercase"
            />
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus size={14} />}
              disabled={!awb.trim()}
              loading={add.isPending}
              onClick={async () => {
                try {
                  await add.mutateAsync({ awb: awb.trim() })
                  setAwb("")
                } catch (err) {
                  toast.error(errorMessage(err))
                }
              }}
            >
              Add
            </Button>
          </div>
        )}
      </div>

      {manage && s.nextStatuses.length > 0 && (
        <div className="space-y-2">
          <Input
            aria-label="Status note"
            placeholder="Note (optional) — e.g. picked up 4 pm"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="py-1.5"
          />
          <div className="flex flex-wrap gap-2">
            {s.nextStatuses.map((status) => (
              <Button
                key={status}
                size="sm"
                variant={status === "CANCELLED" || status === "RTO" ? "ghost" : status === s.nextStatuses[0] ? "primary" : "secondary"}
                loading={pending === status}
                disabled={pending !== null}
                onClick={() => run(status)}
              >
                {MOVE_LABELS[status]}
              </Button>
            ))}
          </div>
          {s.nextStatuses.includes("DISPATCHED") && <p className="text-xs text-faint">Dispatching takes the items out of stock.</p>}
        </div>
      )}
      {s.status === "RETURNED" && (
        <p className="text-sm text-muted">
          The parcel is back. Record a return on the order to put the items back into stock and settle any refund.
        </p>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">History</p>
        <ol className="space-y-1.5">
          {s.events.map((e) => (
            <li key={e.id} className="text-sm">
              <span className="font-medium">{SHIPMENT_STATUS_LABELS[e.status]}</span>
              <span className="text-xs text-muted">
                {" "}
                · {formatDateTime(e.createdAt)} · {e.userName ?? "System"}
                {e.note && ` · ${e.note}`}
              </span>
            </li>
          ))}
        </ol>
      </div>
      {editing && <EditModal s={s} onClose={() => setEditing(false)} />}
    </div>
  )
}
