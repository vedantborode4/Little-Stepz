"use client"

import { Globe, Link2, MessageCircle, PlugZap, ReceiptText, RefreshCw, Truck } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { SYNC_MODE_LABELS, SYNC_SOURCE_LABELS, type SyncPlanDto, type SyncRunDto } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import ConfirmDialog from "@/components/ui/ConfirmDialog"
import { Badge, Card, Skeleton } from "@/components/ui/Display"
import { errorMessage } from "@/lib/api-error"
import { formatDateTime, formatQty } from "@/lib/format"
import { useDryRun, useLinkIds, useSyncRuns, useSyncStatus } from "./api"

const FIELD_LABELS = { regularPrice: "Regular price", offerPrice: "Offer price", stock: "Available stock" }

function Figure({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-bold text-text tabular">{formatQty(value)}</p>
      {hint && <p className="text-[11px] text-faint">{hint}</p>}
    </div>
  )
}

function Plan({ plan }: { plan: SyncPlanDto }) {
  const p = plan.products
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Figure label="Website variants" value={p.websiteVariants} hint={`${p.websiteProducts} products`} />
        <Figure label="Already linked" value={p.alreadyLinked} />
        <Figure label="Can be linked by SKU" value={p.toLink.length} />
        <Figure
          label="Need a look"
          value={p.conflicts.length + p.websiteOnly.length}
          hint={`${p.conflicts.length} conflicts · ${p.websiteOnly.length} not in CRM`}
        />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Figure label="Website orders (90 days)" value={plan.orders.total} hint={`${plan.orders.preOrders} pre-orders`} />
        <Figure label="Already in the CRM" value={plan.orders.alreadyInCrm} />
        <Figure label="Not in the CRM" value={plan.orders.notInCrm} hint="Not imported; read only" />
        <Figure label="Payment references" value={plan.orders.paymentRefs} />
      </div>

      {p.toLink.length > 0 && (
        <details className="rounded-xl border border-border" open>
          <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">Proposed links ({p.toLink.length})</summary>
          <ul className="divide-y divide-border text-sm">
            {p.toLink.map((l) => (
              <li key={l.variantId} className="px-3 py-2 flex flex-wrap justify-between gap-2">
                <span>
                  <span className="font-mono text-xs text-primary">{l.sku}</span> {l.crmName}
                </span>
                <span className="text-xs text-muted">→ {l.websiteName}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {(p.conflicts.length > 0 || p.websiteOnly.length > 0) && (
        <details className="rounded-xl border border-border">
          <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">
            Needs a look ({p.conflicts.length + p.websiteOnly.length})
          </summary>
          <ul className="divide-y divide-border text-sm">
            {p.conflicts.map((c) => (
              <li key={`${c.websiteVariantId}-${c.sku}`} className="px-3 py-2">
                <span className="font-mono text-xs">{c.sku}</span> {c.websiteName}
                <p className="text-xs text-yellow-700 dark:text-yellow-400">{c.reason}</p>
              </li>
            ))}
            {p.websiteOnly.map((w) => (
              <li key={w.sku} className="px-3 py-2">
                <span className="font-mono text-xs">{w.sku}</span> {w.websiteName}
                <p className="text-xs text-muted">On the website only; add it to the CRM (or import it) to link it.</p>
              </li>
            ))}
          </ul>
        </details>
      )}
      {p.differences.length > 0 && (
        <details className="rounded-xl border border-border">
          <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">Differences on linked items ({p.differences.length})</summary>
          <p className="px-3 text-xs text-muted">For information only. The CRM never changes the website&apos;s prices or stock.</p>
          <ul className="divide-y divide-border text-sm">
            {p.differences.map((d) => (
              <li key={`${d.sku}-${d.field}`} className="px-3 py-2 flex flex-wrap justify-between gap-2">
                <span>
                  <span className="font-mono text-xs">{d.sku}</span> {FIELD_LABELS[d.field]}
                </span>
                <span className="text-xs tabular text-muted">
                  CRM {d.crm} · website {d.website}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function RunLine({ run }: { run: SyncRunDto }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
      <span className="flex items-center gap-2">
        <span className="font-mono text-xs text-primary">{run.code}</span>
        {SYNC_MODE_LABELS[run.mode]}
        <Badge tone={run.source === "LIVE" ? "blue" : "gray"}>{run.source === "LIVE" ? "Website" : "Demo data"}</Badge>
        <Badge tone={run.status === "SUCCEEDED" ? "green" : "red"}>{run.status === "SUCCEEDED" ? "Done" : "Failed"}</Badge>
      </span>
      <span className="text-xs text-muted">
        {run.result ? `${run.result.linked} linked · ` : run.error ? `${run.error} · ` : ""}
        {formatDateTime(run.startedAt)}
        {run.createdByName ? ` · ${run.createdByName}` : ""}
      </span>
    </li>
  )
}

const PLACEHOLDERS = [
  {
    icon: Truck,
    title: "Courier tracking (Delhivery)",
    text: "Shipment statuses are entered by hand. Live tracking can be added with an API key.",
  },
  { icon: MessageCircle, title: "WhatsApp", text: "Receipts and reminders are not sent automatically." },
  { icon: ReceiptText, title: "GST e-invoicing", text: "Tax invoices stay in your billing software; the CRM prints simple receipts." },
  {
    icon: RefreshCw,
    title: "Two-way stock sync",
    text: "The CRM never changes the website. Pushing stock to the website is an optional future step that needs your explicit approval.",
  },
]

export default function Integrations() {
  const status = useSyncStatus()
  const runs = useSyncRuns({ limit: 10 })
  const dryRun = useDryRun()
  const link = useLinkIds()
  const [confirmLink, setConfirmLink] = useState(false)

  const last = status.data?.lastRun
  const latestPlan = runs.data?.items.find((r) => r.mode === "DRY_RUN" && r.status === "SUCCEEDED")
  const connection = status.data?.connection

  return (
    <div className="space-y-4 sm:space-y-5">
      <Card
        title="Website (littlestepz.in)"
        action={
          connection === "LIVE" ? (
            <Badge tone="green">Connected · read only</Badge>
          ) : connection === "MOCK" ? (
            <Badge tone="yellow">Demo data · not the website</Badge>
          ) : (
            <Badge tone="gray">Not connected</Badge>
          )
        }
      >
        {status.isLoading ? (
          <Skeleton className="h-32" />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="text-sm text-muted space-y-1 max-w-2xl">
                <p>
                  The CRM only <span className="font-semibold text-text">reads</span> the website, through GET-only export endpoints and a
                  service key. A dry run compares products, variants and recent orders and changes nothing. Linking writes website IDs onto
                  matching CRM variants, and nothing else.
                </p>
                {connection === "LIVE" && <p>Reading from {status.data?.host}.</p>}
                {connection === "MOCK" && (
                  <p className="text-yellow-700 dark:text-yellow-400">
                    Dry runs use built-in SAMPLE data shaped like the website. No website data has been imported, and demo data is never
                    written into the CRM.
                  </p>
                )}
                {connection === "OFF" && <p>Turn it on once the website&apos;s export endpoints are live (see the technical spec).</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="secondary"
                  icon={<PlugZap size={16} />}
                  loading={dryRun.isPending}
                  disabled={connection === "OFF"}
                  onClick={async () => {
                    try {
                      const run = await dryRun.mutateAsync()
                      if (run.status === "FAILED") toast.error(run.error ?? "The dry run failed")
                      else toast.success("Dry run finished; nothing was changed")
                    } catch (err) {
                      toast.error(errorMessage(err))
                    }
                  }}
                >
                  Dry run
                </Button>
                {status.data?.canLink && latestPlan?.source === "LIVE" && (latestPlan.plan?.products.toLink.length ?? 0) > 0 && (
                  <Button icon={<Link2 size={16} />} onClick={() => setConfirmLink(true)}>
                    Link {latestPlan.plan!.products.toLink.length} IDs
                  </Button>
                )}
              </div>
            </div>

            {last?.status === "FAILED" && (
              <p className="rounded-xl bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                Last run failed: {last.error}
              </p>
            )}
            {latestPlan?.plan && (
              <div className="space-y-2">
                <p className="text-xs text-muted">
                  {latestPlan.code} · {SYNC_SOURCE_LABELS[latestPlan.source]} · {formatDateTime(latestPlan.startedAt)}
                </p>
                <Plan plan={latestPlan.plan} />
              </div>
            )}
          </div>
        )}
      </Card>

      {runs.data && runs.data.items.length > 0 && (
        <Card title="Sync history">
          <ul className="divide-y divide-border -my-2">
            {runs.data.items.map((r) => (
              <RunLine key={r.id} run={r} />
            ))}
          </ul>
        </Card>
      )}

      <Card title="Other integrations">
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PLACEHOLDERS.map((p) => (
            <li key={p.title} className="flex gap-3 rounded-xl border border-dashed border-border p-3">
              <p.icon size={18} className="text-faint shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-text">{p.title}</p>
                  <Badge tone="gray">Not connected</Badge>
                </div>
                <p className="text-xs text-muted mt-0.5">{p.text}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs text-faint mt-3 flex items-center gap-1.5">
          <Globe size={12} /> Placeholders only: nothing here sends data anywhere.
        </p>
      </Card>

      {confirmLink && latestPlan && (
        <ConfirmDialog
          title={`Link ${latestPlan.plan!.products.toLink.length} website IDs?`}
          tone="primary"
          message="Writes the website's product and variant IDs onto the matching CRM items from this dry run. The website is not changed. Links that no longer match cleanly are skipped."
          confirmLabel="Link IDs"
          loading={link.isPending}
          onConfirm={async () => {
            try {
              const run = await link.mutateAsync(latestPlan.id)
              toast.success(`${run.result?.linked ?? 0} items linked`)
            } catch (err) {
              toast.error(errorMessage(err))
            }
            setConfirmLink(false)
          }}
          onCancel={() => setConfirmLink(false)}
        />
      )}
    </div>
  )
}
