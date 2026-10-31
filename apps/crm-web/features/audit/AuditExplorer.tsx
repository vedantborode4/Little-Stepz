"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { useState } from "react"
import type { AuditDto, Paginated } from "@repo/crm-schema"
import DataTable from "@/components/ui/DataTable"
import { Badge, PageHeader } from "@/components/ui/Display"
import { Input } from "@/components/ui/Form"
import Modal from "@/components/ui/Modal"
import { ExportMenu, FilterSelect, ListToolbar } from "@/components/ui/Toolbar"
import { getData } from "@/lib/api-client"
import { downloadExport } from "@/lib/download"
import { formatDateTime } from "@/lib/format"
import { useListState } from "@/lib/use-list-state"

const ENTITIES = ["User", "BusinessProfile", "Location", "ReceivingAccount"]

type AuditFilters = { entity?: string; action?: string; from?: string; to?: string; entityId?: string }

function useAudit(params: object) {
  return useQuery({
    queryKey: ["audit", params],
    queryFn: () => getData<Paginated<AuditDto>>("/audit", params),
    placeholderData: keepPreviousData,
  })
}

function actionTone(action: string) {
  if (action.includes("failed") || action.includes("reuse")) return "red" as const
  if (action.endsWith("created")) return "green" as const
  if (action.startsWith("auth.")) return "gray" as const
  return "blue" as const
}

/** Field-by-field before → after for one audit entry. */
function AuditDiff({ entry }: { entry: AuditDto }) {
  const before = (entry.before ?? {}) as Record<string, unknown>
  const after = (entry.after ?? {}) as Record<string, unknown>
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
  const show = (v: unknown) =>
    v === null || v === undefined || v === "" ? (
      <span className="text-faint">—</span>
    ) : typeof v === "object" ? (
      JSON.stringify(v)
    ) : (
      String(v)
    )

  if (keys.length === 0) return <p className="text-sm text-muted">No field changes recorded for this event.</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-surface-2">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold text-muted">Field</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-muted">Before</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-muted">After</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => {
            const changed = JSON.stringify(before[key]) !== JSON.stringify(after[key])
            return (
              <tr key={key} className={changed ? "bg-yellow-50/60 dark:bg-yellow-500/5" : undefined}>
                <td className="px-3 py-2 border-t border-border font-mono text-xs text-muted">{key}</td>
                <td className="px-3 py-2 border-t border-border break-all">{show(before[key])}</td>
                <td className="px-3 py-2 border-t border-border break-all">{show(after[key])}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function AuditExplorer() {
  const { state, update, params } = useListState<AuditFilters>({ sort: "createdAt:desc" })
  const { data, isLoading } = useAudit(params)
  const [selected, setSelected] = useState<AuditDto | null>(null)
  const f = state.filters

  const columns: ColumnDef<AuditDto>[] = [
    {
      id: "createdAt",
      header: "When",
      meta: { sortKey: "createdAt", cellClassName: "whitespace-nowrap text-muted" },
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
    { id: "user", header: "User", cell: ({ row }) => row.original.userName ?? <span className="text-faint">System</span> },
    {
      id: "action",
      header: "Action",
      meta: { sortKey: "action" },
      cell: ({ row }) => <Badge tone={actionTone(row.original.action)}>{row.original.action}</Badge>,
    },
    {
      id: "entity",
      header: "Record",
      meta: { sortKey: "entity" },
      cell: ({ row }) => (
        <span>
          {row.original.entity} <span className="font-mono text-xs text-faint">{row.original.entityId.slice(0, 8)}</span>
        </span>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Audit History"
        subtitle="Every change, sign-in and correction. Entries are permanent and cannot be edited or deleted."
      />
      <ListToolbar actions={<ExportMenu onExport={(format) => downloadExport("/audit", params, format)} />}>
        <FilterSelect label="Record type" value={f.entity} onChange={(entity) => update({ filters: { entity } })}>
          <option value="">All records</option>
          {ENTITIES.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Action" value={f.action} onChange={(action) => update({ filters: { action } })}>
          <option value="">All actions</option>
          <option value="auth.">Sign-ins & sessions</option>
          <option value="user.">Users</option>
          <option value="location.">Locations</option>
          <option value="receiving_account.">Receiving accounts</option>
          <option value="business_profile.">Business profile</option>
        </FilterSelect>
        <div className="flex gap-2">
          <Input
            type="date"
            aria-label="From date"
            value={f.from ?? ""}
            onChange={(e) => update({ filters: { from: e.target.value || undefined } })}
            className="py-2 sm:w-40"
          />
          <Input
            type="date"
            aria-label="To date"
            value={f.to ?? ""}
            onChange={(e) => update({ filters: { to: e.target.value || undefined } })}
            className="py-2 sm:w-40"
          />
        </div>
      </ListToolbar>
      <DataTable
        columns={columns}
        data={data?.items}
        total={data?.total ?? 0}
        page={state.page}
        limit={state.limit}
        sort={state.sort}
        loading={isLoading}
        onPageChange={(page) => update({ page })}
        onSortChange={(sort) => update({ sort })}
        onRowClick={setSelected}
        getRowId={(r) => r.id}
        emptyTitle="No audit entries match these filters"
        mobileCard={(r) => (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Badge tone={actionTone(r.action)}>{r.action}</Badge>
              <span className="text-xs text-faint">{formatDateTime(r.createdAt)}</span>
            </div>
            <p className="text-xs text-muted">
              {r.userName ?? "System"} · {r.entity}
            </p>
          </div>
        )}
      />
      {selected && (
        <Modal title={selected.action} onClose={() => setSelected(null)} width="max-w-2xl">
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted text-xs">When</dt>
                <dd>{formatDateTime(selected.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-muted text-xs">By</dt>
                <dd>{selected.userName ?? "System"}</dd>
              </div>
              <div>
                <dt className="text-muted text-xs">Record</dt>
                <dd>{selected.entity}</dd>
              </div>
              <div>
                <dt className="text-muted text-xs">Record ID</dt>
                <dd className="font-mono text-xs break-all">{selected.entityId}</dd>
              </div>
            </dl>
            <AuditDiff entry={selected} />
          </div>
        </Modal>
      )}
    </div>
  )
}
