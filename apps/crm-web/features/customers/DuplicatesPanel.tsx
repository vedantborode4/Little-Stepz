"use client"

import { GitMerge } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { DUPLICATE_REASON_LABELS, type DuplicateMatchDto, type DuplicatePairDto } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import ConfirmDialog from "@/components/ui/ConfirmDialog"
import { Badge, EmptyState, PageHeader, Skeleton } from "@/components/ui/Display"
import { Field, Textarea } from "@/components/ui/Form"
import { errorMessage } from "@/lib/api-error"
import { useDuplicatePairs, useMergeCustomer } from "./api"
import { CustomerTabs } from "./shared"

function Side({ c }: { c: DuplicateMatchDto }) {
  return (
    <div className="min-w-0">
      <Link href={`/customers/${c.id}`} className="text-sm font-semibold text-text hover:text-primary">
        {c.name}
      </Link>
      <p className="text-xs text-faint">
        <span className="font-mono">{c.code}</span>
        {[c.mobile, c.city, c.pincode].filter(Boolean).map((v) => ` · ${v}`)}
      </p>
    </div>
  )
}

/** Merge `from` into `into`; the confirm dialog spells out which record survives. */
function MergePair({ from, into, onDone }: { from: DuplicateMatchDto; into: DuplicateMatchDto; onDone: () => void }) {
  const merge = useMergeCustomer(from.id)
  const [reason, setReason] = useState("Duplicate found in review")
  return (
    <ConfirmDialog
      title={`Keep ${into.code}, fold ${from.code} into it?`}
      message={
        <div className="space-y-3">
          <p>
            <strong>{from.name}</strong> becomes an inactive pointer to <strong>{into.name}</strong>. This can&apos;t be undone.
          </p>
          <Field label="Reason" htmlFor="pair-reason">
            <Textarea id="pair-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
      }
      confirmLabel="Merge"
      confirmDisabled={!reason.trim()}
      loading={merge.isPending}
      onCancel={onDone}
      onConfirm={async () => {
        try {
          await merge.mutateAsync({ intoId: into.id, reason: reason.trim() })
          toast.success(`Merged ${from.code} into ${into.code}`)
          onDone()
        } catch (err) {
          toast.error(errorMessage(err))
        }
      }}
    />
  )
}

export default function DuplicatesPanel() {
  const { data, isLoading } = useDuplicatePairs()
  const [merging, setMerging] = useState<{ from: DuplicateMatchDto; into: DuplicateMatchDto } | null>(null)

  const row = (p: DuplicatePairDto) => (
    <li key={`${p.a.id}-${p.b.id}`} className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_auto] gap-3 items-center px-4 sm:px-5 py-3.5">
      <Side c={p.a} />
      <Side c={p.b} />
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <Badge tone={p.reason === "NAME_AND_PIN" ? "red" : "yellow"}>{DUPLICATE_REASON_LABELS[p.reason]}</Badge>
        <Button variant="secondary" size="sm" icon={<GitMerge size={13} />} onClick={() => setMerging({ from: p.b, into: p.a })}>
          Keep {p.a.code}
        </Button>
        <Button variant="secondary" size="sm" icon={<GitMerge size={13} />} onClick={() => setMerging({ from: p.a, into: p.b })}>
          Keep {p.b.code}
        </Button>
      </div>
    </li>
  )

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Possible duplicates: similar names, ranked with matching PIN codes first. Duplicate mobiles are blocked when saving."
      />
      <CustomerTabs />
      {isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : !data?.length ? (
        <div className="bg-surface border border-border rounded-2xl">
          <EmptyState title="No likely duplicates" hint="Pairs with similar names show up here for review." />
        </div>
      ) : (
        <ul className="bg-surface border border-border rounded-2xl divide-y divide-border">{data.map(row)}</ul>
      )}
      {merging && <MergePair from={merging.from} into={merging.into} onDone={() => setMerging(null)} />}
    </div>
  )
}
