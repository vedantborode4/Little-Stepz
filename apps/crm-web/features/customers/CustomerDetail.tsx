"use client"

import { Eye, GitMerge, Mail, MessageCircle, Pencil, Phone, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { formatMobile, INDIAN_STATES, type CustomerContactDto, type CustomerDetailDto, type CustomerListItemDto } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import ConfirmDialog from "@/components/ui/ConfirmDialog"
import { Badge, Card, DetailRow, EmptyState, PageHeader, Skeleton, StatCard } from "@/components/ui/Display"
import { Field, Input, Textarea } from "@/components/ui/Form"
import Modal from "@/components/ui/Modal"
import { errorMessage } from "@/lib/api-error"
import { formatDate, formatMoney } from "@/lib/format"
import { useCan } from "@/store/auth.store"
import VariantPicker from "../inventory/VariantPicker"
import { useOrders } from "../sales/api"
import { OrderStatusBadge } from "../sales/shared"
import { revealContact, useCustomer, useMergeCustomer, useRemoveCustomerPrice, useSaveCustomer, useSetCustomerPrice } from "./api"
import CustomerForm from "./CustomerForm"
import CustomerPicker from "./CustomerPicker"
import { creditTerms, CustomerTypeBadge } from "./shared"

type PriceTarget = { variantId: string; label: string; price?: string }

function ContactCard({ customer }: { customer: CustomerDetailDto }) {
  const can = useCan()
  const [contact, setContact] = useState<CustomerContactDto | null>(null)
  const [loading, setLoading] = useState(false)

  const reveal = async () => {
    setLoading(true)
    try {
      setContact(await revealContact(customer.id))
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const mobile = contact?.mobile ? formatMobile(contact.mobile) : customer.mobile
  const whatsapp = contact ? (contact.whatsapp ?? contact.mobile) : null

  return (
    <Card
      title="Contact"
      action={
        !contact &&
        can("customers.contact.reveal") &&
        (customer.mobile || customer.email || customer.whatsapp) && (
          <Button variant="ghost" size="sm" icon={<Eye size={14} />} loading={loading} onClick={reveal}>
            Show
          </Button>
        )
      }
    >
      <dl>
        <DetailRow label="Mobile">
          {contact?.mobile ? (
            <a href={`tel:${contact.mobile}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
              <Phone size={13} /> {mobile}
            </a>
          ) : (
            (mobile ?? "—")
          )}
        </DetailRow>
        <DetailRow label="WhatsApp">
          {whatsapp ? (
            <a
              href={`https://wa.me/${whatsapp.replace("+", "")}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-primary hover:underline"
            >
              <MessageCircle size={13} /> {formatMobile(whatsapp)}
            </a>
          ) : (
            (customer.whatsapp ?? (customer.mobile ? "Same as mobile" : "—"))
          )}
        </DetailRow>
        <DetailRow label="Email">
          {contact?.email ? (
            <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
              <Mail size={13} /> {contact.email}
            </a>
          ) : (
            (customer.email ?? "—")
          )}
        </DetailRow>
      </dl>
      {!contact && <p className="mt-2 text-xs text-faint">Showing full details is recorded in the audit log.</p>}
    </Card>
  )
}

function PriceModal({ customerId, target, onClose }: { customerId: string; target: PriceTarget; onClose: () => void }) {
  const save = useSetCustomerPrice(customerId)
  const [price, setPrice] = useState(target.price ?? "")
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await save.mutateAsync({ variantId: target.variantId, price: price.trim() })
      toast.success("Customer price saved")
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Modal
      title="Customer price"
      onClose={onClose}
      width="max-w-sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="cp-form" loading={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form id="cp-form" onSubmit={submit} className="space-y-3" noValidate>
        <p className="text-sm font-medium">{target.label}</p>
        <Field label="Price for this customer (₹, incl. GST)" htmlFor="cp-price" error={error ?? undefined}>
          <Input id="cp-price" inputMode="decimal" autoFocus value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <p className="text-xs text-faint">It wins over the regular, offer, wholesale and quantity prices at POS and on orders.</p>
      </form>
    </Modal>
  )
}

function PricesCard({ customer }: { customer: CustomerDetailDto }) {
  const can = useCan()
  const canEdit = can("products.manage") && !customer.mergedInto
  const remove = useRemoveCustomerPrice(customer.id)
  const [editing, setEditing] = useState<PriceTarget | null>(null)
  const [removing, setRemoving] = useState<PriceTarget | null>(null)

  return (
    <section className="bg-surface border border-border rounded-2xl overflow-hidden">
      <div className="px-4 sm:px-5 py-3.5 border-b border-border space-y-3">
        <h2 className="text-sm font-semibold">Customer prices ({customer.prices.length})</h2>
        {canEdit && (
          <VariantPicker
            excludeIds={new Set(customer.prices.map((p) => p.variantId))}
            onPick={(picked) => picked[0] && setEditing({ variantId: picked[0].variantId, label: picked[0].label })}
          />
        )}
      </div>
      {customer.prices.length === 0 ? (
        <p className="px-4 sm:px-5 py-6 text-sm text-muted">No negotiated prices. List prices apply.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5 text-left">Item</th>
                <th className="px-4 py-2.5 text-right whitespace-nowrap">Regular</th>
                <th className="px-4 py-2.5 text-right whitespace-nowrap">Wholesale</th>
                <th className="px-4 py-2.5 text-right whitespace-nowrap">Customer price</th>
                {canEdit && <th className="px-4 py-2.5" />}
              </tr>
            </thead>
            <tbody>
              {customer.prices.map((p) => {
                const label = `${p.productName} — ${p.variantName}`
                return (
                  <tr key={p.variantId} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="font-medium">{label}</p>
                      <p className="text-xs font-mono text-faint">{p.sku}</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular text-muted">{formatMoney(p.regularPrice)}</td>
                    <td className="px-4 py-3 text-right tabular text-muted">{formatMoney(p.wholesalePrice)}</td>
                    <td className="px-4 py-3 text-right tabular font-semibold">{formatMoney(p.price)}</td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Edit price"
                          icon={<Pencil size={14} />}
                          onClick={() => setEditing({ variantId: p.variantId, label, price: p.price })}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Remove price"
                          icon={<Trash2 size={14} />}
                          onClick={() => setRemoving({ variantId: p.variantId, label })}
                        />
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {editing && <PriceModal customerId={customer.id} target={editing} onClose={() => setEditing(null)} />}
      {removing && (
        <ConfirmDialog
          title="Remove customer price?"
          message={`${removing.label} goes back to list prices for ${customer.name}. Past sales keep the price they were sold at.`}
          confirmLabel="Remove"
          loading={remove.isPending}
          onCancel={() => setRemoving(null)}
          onConfirm={async () => {
            try {
              await remove.mutateAsync(removing.variantId)
              setRemoving(null)
            } catch (err) {
              toast.error(errorMessage(err))
            }
          }}
        />
      )}
    </section>
  )
}

function MergeModal({ customer, onClose }: { customer: CustomerDetailDto; onClose: () => void }) {
  const router = useRouter()
  const merge = useMergeCustomer(customer.id)
  const [target, setTarget] = useState<CustomerListItemDto | null>(null)
  const [reason, setReason] = useState("")
  const [confirming, setConfirming] = useState(false)

  if (confirming && target) {
    return (
      <ConfirmDialog
        title={`Merge ${customer.code} into ${target.code}?`}
        message={
          <>
            <strong>{customer.name}</strong> becomes an inactive pointer to <strong>{target.name}</strong>. Their prices, history and any
            missing contact details move across. This can&apos;t be undone.
          </>
        }
        confirmLabel="Merge"
        loading={merge.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={async () => {
          try {
            await merge.mutateAsync({ intoId: target.id, reason: reason.trim() })
            toast.success(`Merged into ${target.code}`)
            router.push(`/customers/${target.id}`)
          } catch (err) {
            toast.error(errorMessage(err))
            setConfirming(false)
          }
        }}
      />
    )
  }

  return (
    <Modal
      title={`Merge ${customer.name} into…`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" disabled={!target || !reason.trim()} onClick={() => setConfirming(true)}>
            Review merge
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Use this when the same person was added twice. Pick the customer to <strong>keep</strong>; {customer.code} is folded into it.
        </p>
        {target ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">{target.name}</p>
              <p className="text-xs text-faint">
                <span className="font-mono">{target.code}</span>
                {[target.mobile, target.city].filter(Boolean).map((v) => ` · ${v}`)}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setTarget(null)}>
              Change
            </Button>
          </div>
        ) : (
          <CustomerPicker excludeId={customer.id} onPick={setTarget} autoFocus />
        )}
        <Field label="Reason" htmlFor="merge-reason" required>
          <Textarea
            id="merge-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Same mobile, added twice"
          />
        </Field>
      </div>
    </Modal>
  )
}

function RecentOrders({ customerId }: { customerId: string }) {
  const { data } = useOrders({ customerId, limit: 10, sort: "orderDate:desc" })
  return (
    <Card title={data && data.total > 10 ? `Recent orders (10 of ${data.total})` : "Recent orders"}>
      {!data?.items.length ? (
        <p className="text-sm text-muted">No orders yet.</p>
      ) : (
        <ul className="divide-y divide-border -my-2">
          {data.items.map((o) => (
            <li key={o.id}>
              <Link href={`/sales/${o.id}`} className="flex items-center gap-3 py-2 text-sm hover:text-primary">
                <span className="font-mono text-xs">{o.code}</span>
                <span className="text-muted">{formatDate(o.orderDate)}</span>
                <span className="flex-1" />
                <span className="tabular font-medium">{formatMoney(o.grandTotal)}</span>
                <OrderStatusBadge status={o.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function CustomerView({ customer }: { customer: CustomerDetailDto }) {
  const can = useCan()
  const save = useSaveCustomer()
  const [editing, setEditing] = useState<CustomerContactDto | null>(null)
  const [opening, setOpening] = useState(false)
  const [merging, setMerging] = useState(false)
  const [toggling, setToggling] = useState(false)
  const merged = customer.mergedInto
  const canManage = can("customers.manage") && !merged
  const state = INDIAN_STATES.find((s) => s.code === customer.stateCode)?.name

  const openEdit = async () => {
    setOpening(true)
    try {
      setEditing(await revealContact(customer.id))
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setOpening(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title={customer.name}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="font-mono">{customer.code}</span>
            <CustomerTypeBadge type={customer.type} />
            {!customer.isActive && !merged && <Badge tone="gray">Inactive</Badge>}
            <span>Since {formatDate(customer.createdAt)}</span>
          </span>
        }
        action={
          <>
            {canManage && (
              <Button variant="secondary" icon={<Pencil size={15} />} loading={opening} onClick={openEdit}>
                Edit
              </Button>
            )}
            {canManage && (
              <Button variant="ghost" onClick={() => setToggling(true)}>
                {customer.isActive ? "Deactivate" : "Reactivate"}
              </Button>
            )}
            {can("customers.merge") && !merged && (
              <Button variant="ghost" icon={<GitMerge size={15} />} onClick={() => setMerging(true)}>
                Merge into…
              </Button>
            )}
          </>
        }
      />

      {merged && (
        <div className="rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm">
          This customer was merged into{" "}
          <Link href={`/customers/${merged.id}`} className="font-semibold text-primary hover:underline">
            {merged.name} ({merged.code})
          </Link>
          . Their history now lives there.
        </div>
      )}

      <div className="grid grid-cols-1 2xl:grid-cols-3 gap-4 sm:gap-5 items-start">
        <div className="2xl:col-span-2 space-y-4 sm:space-y-5">
          <div className="grid grid-cols-3 gap-3 sm:gap-5">
            <StatCard title="Orders" value={customer.stats.orders} />
            <StatCard title="Lifetime value" value={formatMoney(customer.stats.lifetimeValue)} hint="Fulfilled orders, incl. GST" />
            <StatCard title="Last order" value={<span className="text-base">{formatDate(customer.stats.lastOrderDate)}</span>} />
          </div>
          {can("sales.view") && <RecentOrders customerId={customer.id} />}
          <PricesCard customer={customer} />
        </div>
        <div className="space-y-4 sm:space-y-5">
          <ContactCard customer={customer} />
          <Card title="Address & terms">
            <dl>
              <DetailRow label="Address">{customer.addressLine ?? "—"}</DetailRow>
              <DetailRow label="City / PIN">{[customer.city, customer.pincode].filter(Boolean).join(" · ") || "—"}</DetailRow>
              <DetailRow label="State">{state ?? "—"}</DetailRow>
              <DetailRow label="Credit terms">{creditTerms(customer, formatMoney) ?? "Pays at purchase"}</DetailRow>
            </dl>
            {customer.notes && <p className="mt-3 text-sm text-muted whitespace-pre-line">{customer.notes}</p>}
          </Card>
          {customer.mergedFrom.length > 0 && (
            <Card title="Merged duplicates">
              <ul className="space-y-1 text-sm">
                {customer.mergedFrom.map((m) => (
                  <li key={m.id}>
                    <Link href={`/customers/${m.id}`} className="text-primary hover:underline">
                      {m.name} ({m.code})
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      {editing && <CustomerForm customer={{ detail: customer, contact: editing }} onClose={() => setEditing(null)} />}
      {merging && <MergeModal customer={customer} onClose={() => setMerging(false)} />}
      {toggling && (
        <ConfirmDialog
          title={customer.isActive ? `Deactivate ${customer.name}?` : `Reactivate ${customer.name}?`}
          message={
            customer.isActive ? "They're hidden from lists and pickers. History is kept." : "They show up in lists and pickers again."
          }
          confirmLabel={customer.isActive ? "Deactivate" : "Reactivate"}
          tone={customer.isActive ? "danger" : "primary"}
          loading={save.isPending}
          onCancel={() => setToggling(false)}
          onConfirm={async () => {
            try {
              await save.mutateAsync({ id: customer.id, input: { isActive: !customer.isActive } })
              setToggling(false)
            } catch (err) {
              toast.error(errorMessage(err))
            }
          }}
        />
      )}
    </div>
  )
}

export default function CustomerDetail({ id }: { id: string }) {
  const { data, isLoading } = useCustomer(id)
  if (isLoading) return <Skeleton className="h-96 rounded-2xl" />
  if (!data) return <EmptyState title="Customer not found" />
  return <CustomerView customer={data} />
}
