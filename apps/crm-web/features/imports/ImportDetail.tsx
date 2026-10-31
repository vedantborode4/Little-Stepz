"use client"

import type { ColumnDef } from "@tanstack/react-table"
import clsx from "clsx"
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, ListChecks, RotateCcw, XCircle } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  IMPORT_FIELDS,
  IMPORT_KIND_LABELS,
  IMPORT_KINDS_WITH_LOCATION,
  IMPORT_OPTIONS,
  IMPORT_ROW_STATUS_LABELS,
  type ImportBatchDto,
  type ImportKind,
  type ImportRowDto,
  type ImportRowStatus,
} from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import ConfirmDialog from "@/components/ui/ConfirmDialog"
import DataTable from "@/components/ui/DataTable"
import { Badge, Card, EmptyState, PageHeader, Skeleton, StatCard, type BadgeTone } from "@/components/ui/Display"
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/Form"
import { useExpenseCategories } from "@/features/finance/api"
import { useLocations, useReceivingAccounts } from "@/features/settings/api"
import { errorMessage } from "@/lib/api-error"
import { formatDateTime, formatQty } from "@/lib/format"
import { useListState } from "@/lib/use-list-state"
import { apiErrorsToMap } from "@/lib/validation"
import { useImport, useImportAction, useImportRows, useImportTemplates, useMapImport } from "./api"
import { ImportStatusBadge } from "./ImportsList"

const ROW_TONES: Record<ImportRowStatus, BadgeTone> = {
  PENDING: "gray",
  VALID: "blue",
  ERROR: "red",
  DUPLICATE: "yellow",
  IMPORTED: "green",
}

/** The columns that identify a row at a glance, per kind of import. */
const KEY_FIELDS: Record<ImportKind, string[]> = {
  PRODUCTS: ["productName", "optionValue", "sku", "regularPrice"],
  OPENING_STOCK: ["sku", "quantity", "unitCost"],
  CUSTOMERS: ["name", "mobile", "city"],
  HISTORICAL_SALES: ["billId", "saleDate", "sku", "quantity", "unitPrice"],
  EXPENSES: ["date", "category", "amount", "account"],
}

const LOCATION_LABEL: Partial<Record<ImportKind, { label: string; hint: string }>> = {
  OPENING_STOCK: { label: "Where is this stock?", hint: "Opening stock lands here" },
  HISTORICAL_SALES: { label: "Where were these sales made?", hint: "The store the past bills belong to" },
}

/** What each kind of approval does, in the owner's words, for the confirm dialog and the rolled-back note. */
const EFFECT: Record<ImportKind, { approve: string; rollback: string; rolledBack: string }> = {
  PRODUCTS: {
    approve: "Creates the products now, with any new categories and brands.",
    rollback: "The imported products and variants are archived and their SKUs freed.",
    rolledBack: "The products are archived and their SKUs freed for a corrected file.",
  },
  OPENING_STOCK: {
    approve: "Posts one opening-stock entry into the chosen location.",
    rollback: "A reversal entry takes the imported stock back out.",
    rolledBack: "The opening stock was reversed in the ledger.",
  },
  CUSTOMERS: {
    approve: "Creates the customers now.",
    rollback: "The imported customers are removed.",
    rolledBack: "The customers were removed.",
  },
  HISTORICAL_SALES: {
    approve:
      "Records each bill as a completed sale on its own date, with its payments. Stock is not changed. Once approved, bills can't be rolled back; a mistake is corrected with a return or refund.",
    rollback: "",
    rolledBack: "",
  },
  EXPENSES: {
    approve: "Records each expense on its own date, paid from its account.",
    rollback: "Each imported expense is voided by a reversal entry dated today.",
    rolledBack: "The expenses were voided.",
  },
}

const STEPS = ["Upload", "Map columns", "Review rows", "Approve"]

function Steps({ batch }: { batch: ImportBatchDto }) {
  const current = batch.status === "UPLOADED" ? 1 : batch.status === "VALIDATED" ? 2 : 4
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs mb-5">
      {STEPS.map((label, i) => {
        const done = i < current || batch.status === "IMPORTED" || batch.status === "ROLLED_BACK"
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium",
                done
                  ? "bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-400"
                  : i === current
                    ? "bg-primary text-white"
                    : "bg-surface-2 text-muted",
              )}
            >
              {done ? <Check size={12} /> : <span className="tabular">{i + 1}</span>}
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="w-4 h-px bg-border" />}
          </li>
        )
      })}
    </ol>
  )
}

function MappingForm({ batch, onDone }: { batch: ImportBatchDto; onDone?: () => void }) {
  const fields = IMPORT_FIELDS[batch.kind]
  const map = useMapImport(batch.id)
  const templates = useImportTemplates(batch.kind)
  const locations = useLocations()
  const accounts = useReceivingAccounts()
  const expenseCategories = useExpenseCategories()
  const [mapping, setMapping] = useState<Record<string, string | null>>(batch.mapping ?? batch.suggestedMapping)
  const [locationId, setLocationId] = useState(batch.locationId ?? "")
  const [options, setOptions] = useState<Record<string, string | null>>(batch.options)
  const location = LOCATION_LABEL[batch.kind]
  const choices = IMPORT_OPTIONS[batch.kind].filter((o) => mapping[o.whenMapped])
  const [templateName, setTemplateName] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const sample = batch.sample[0] ?? {}

  const applyTemplate = (id: string) => {
    const t = templates.data?.find((x) => x.id === id)
    if (!t) return
    setMapping(
      Object.fromEntries(
        fields.map((f) => [f.key, t.mapping[f.key] && batch.headers.includes(t.mapping[f.key]!) ? t.mapping[f.key]! : null]),
      ),
    )
  }

  const submit = async () => {
    setErrors({})
    setFormError(null)
    try {
      await map.mutateAsync({ mapping, locationId: locationId || null, options, saveTemplateAs: templateName || null })
      toast.success("Every row has been checked")
      onDone?.()
    } catch (err) {
      setErrors(apiErrorsToMap(err))
      setFormError(errorMessage(err))
    }
  }

  return (
    <Card
      title="Match the file's columns"
      action={
        templates.data && templates.data.length > 0 ? (
          <div className="w-48">
            <Select
              aria-label="Use a saved mapping"
              defaultValue=""
              onChange={(e) => applyTemplate(e.target.value)}
              className="py-1.5 text-xs"
            >
              <option value="">Use a saved mapping…</option>
              {templates.data.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <FormError message={formError} />
        {location && IMPORT_KINDS_WITH_LOCATION.includes(batch.kind) && (
          <Field label={location.label} htmlFor="im-location" required error={errors.locationId}>
            <Select id="im-location" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">Choose a location…</option>
              {locations.data
                ?.filter((l) => l.isActive)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
            </Select>
          </Field>
        )}
        <div className="divide-y divide-border border border-border rounded-xl">
          {fields.map((f) => {
            const header = mapping[f.key] ?? ""
            return (
              <div
                key={f.key}
                className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_minmax(0,1fr)] gap-2 sm:gap-4 items-center px-3 sm:px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text">
                    {f.label}
                    {f.required && <span className="text-primary"> *</span>}
                  </p>
                  {f.hint && <p className="text-xs text-faint">{f.hint}</p>}
                  {errors[f.key] && <p className="text-xs text-red-500 mt-0.5">{errors[f.key]}</p>}
                </div>
                <Select
                  aria-label={`Column for ${f.label}`}
                  value={header}
                  onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value || null }))}
                  className="py-1.5"
                >
                  <option value="">— not in this file —</option>
                  {batch.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-muted truncate" title={header ? sample[header] : undefined}>
                  {header ? sample[header] || <span className="text-faint">(blank in the first row)</span> : ""}
                </p>
              </div>
            )
          })}
        </div>
        {choices.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {choices.map((o) => {
              const list = o.type === "account" ? accounts.data : expenseCategories.data
              return (
                <Field key={o.key} label={o.label} htmlFor={`im-${o.key}`} required error={errors[`options.${o.key}`]}>
                  <Select
                    id={`im-${o.key}`}
                    value={options[o.key] ?? ""}
                    onChange={(e) => setOptions((x) => ({ ...x, [o.key]: e.target.value || null }))}
                  >
                    <option value="">Choose…</option>
                    {list
                      ?.filter((x) => x.isActive)
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                  </Select>
                </Field>
              )
            })}
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
          <Field
            label="Save this mapping for next time"
            htmlFor="im-template"
            hint="Optional, e.g. the supplier's sheet"
            className="sm:w-72"
          >
            <Input
              id="im-template"
              value={templateName}
              maxLength={60}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template name"
            />
          </Field>
          <Button icon={<ListChecks size={16} />} loading={map.isPending} onClick={submit}>
            Check every row
          </Button>
        </div>
      </div>
    </Card>
  )
}

function RowsTable({ batch }: { batch: ImportBatchDto }) {
  const { state, update, params } = useListState<{ status?: ImportRowStatus }>({ limit: 50 })
  const rows = useImportRows(batch.id, params)
  const mapping = batch.mapping ?? {}
  const keyFields = KEY_FIELDS[batch.kind].filter((k) => mapping[k])
  const labels = useMemo(() => Object.fromEntries(IMPORT_FIELDS[batch.kind].map((f) => [f.key, f.label])), [batch.kind])

  const filters: { value: ImportRowStatus | undefined; label: string; count?: number }[] = [
    { value: undefined, label: "All", count: batch.totalRows },
    ...(batch.status === "IMPORTED" || batch.status === "ROLLED_BACK"
      ? [{ value: "IMPORTED" as const, label: "Imported", count: batch.importedRows }]
      : [{ value: "VALID" as const, label: "Ready", count: batch.validRows }]),
    { value: "ERROR", label: "Errors", count: batch.errorRows },
    { value: "DUPLICATE", label: "Duplicates", count: batch.duplicateRows },
  ]

  const columns: ColumnDef<ImportRowDto>[] = [
    { id: "line", header: "Line", meta: { cellClassName: "tabular text-muted" }, cell: ({ row }) => row.original.rowNumber },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <Badge tone={ROW_TONES[row.original.status]}>{IMPORT_ROW_STATUS_LABELS[row.original.status]}</Badge>,
    },
    ...keyFields.map(
      (k): ColumnDef<ImportRowDto> => ({
        id: k,
        header: labels[k],
        cell: ({ row }) => (
          <span className={clsx("text-sm", k !== "productName" && k !== "name" && "whitespace-nowrap")}>
            {row.original.values[mapping[k]!] || <span className="text-faint">—</span>}
          </span>
        ),
      }),
    ),
    {
      id: "issues",
      header: "What to fix",
      meta: { cellClassName: "whitespace-normal min-w-64" },
      cell: ({ row }) =>
        row.original.errors.length > 0 ? (
          <ul className="text-xs text-red-500 space-y-0.5">
            {row.original.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : row.original.duplicateOf ? (
          <span className="text-xs text-yellow-700 dark:text-yellow-400">{row.original.duplicateOf}</span>
        ) : (
          <span className="text-faint">—</span>
        ),
    },
  ]

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.label}
            type="button"
            onClick={() => update({ filters: { status: f.value } })}
            aria-pressed={state.filters.status === f.value}
            className={clsx(
              "rounded-full px-3 py-1 text-xs font-medium border transition",
              state.filters.status === f.value ? "bg-primary text-white border-primary" : "border-border text-muted hover:text-text",
            )}
          >
            {f.label} <span className="tabular opacity-80">{formatQty(f.count ?? 0)}</span>
          </button>
        ))}
      </div>
      <DataTable
        columns={columns}
        data={rows.data?.items}
        total={rows.data?.total ?? 0}
        page={state.page}
        limit={state.limit}
        loading={rows.isLoading}
        onPageChange={(page) => update({ page })}
        getRowId={(r) => r.id}
        emptyTitle="No rows here"
        mobileCard={(r) => (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                Line {r.rowNumber} ·{" "}
                {keyFields
                  .map((k) => r.values[mapping[k]!])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join(" · ")}
              </p>
              <Badge tone={ROW_TONES[r.status]}>{IMPORT_ROW_STATUS_LABELS[r.status]}</Badge>
            </div>
            {r.errors.map((e) => (
              <p key={e} className="text-xs text-red-500">
                {e}
              </p>
            ))}
            {r.duplicateOf && <p className="text-xs text-yellow-700 dark:text-yellow-400">{r.duplicateOf}</p>}
          </div>
        )}
      />
    </div>
  )
}

export default function ImportDetail({ id }: { id: string }) {
  const { data: batch, isLoading } = useImport(id)
  const action = useImportAction(id)
  const [remapping, setRemapping] = useState(false)
  const [confirm, setConfirm] = useState<"approve" | "cancel" | "rollback" | null>(null)
  const [reason, setReason] = useState("")

  if (isLoading) return <Skeleton className="h-96 rounded-2xl" />
  if (!batch) return <EmptyState title="Import not found" />

  const run = async (kind: "approve" | "cancel" | "rollback") => {
    try {
      await action.mutateAsync({ action: kind, reason: kind === "rollback" ? reason : undefined })
      toast.success(kind === "approve" ? "Imported" : kind === "rollback" ? "Rolled back" : "Import cancelled")
      setConfirm(null)
      setReason("")
    } catch (err) {
      toast.error(errorMessage(err))
      setConfirm(null)
    }
  }

  const mapping = batch.status === "UPLOADED" || remapping
  const open = batch.status === "UPLOADED" || batch.status === "VALIDATED"

  return (
    <div className="space-y-4 sm:space-y-5">
      <Link href="/imports" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={14} /> All imports
      </Link>
      <PageHeader
        title={`${batch.code} · ${IMPORT_KIND_LABELS[batch.kind]}`}
        subtitle={`${batch.fileName}${batch.sheetName ? ` › ${batch.sheetName}` : ""} · headings on row ${batch.headerRow} · ${formatQty(batch.totalRows)} rows · uploaded ${formatDateTime(batch.createdAt)}${batch.createdByName ? ` by ${batch.createdByName}` : ""}`}
        action={
          <>
            <ImportStatusBadge status={batch.status} />
            {open && (
              <Button variant="secondary" size="sm" onClick={() => setConfirm("cancel")}>
                Cancel import
              </Button>
            )}
          </>
        }
      />
      <Steps batch={batch} />

      {mapping ? (
        <MappingForm batch={batch} onDone={() => setRemapping(false)} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            {batch.status === "IMPORTED" || batch.status === "ROLLED_BACK" ? (
              <StatCard
                title="Imported"
                value={formatQty(batch.importedRows)}
                hint={`of ${formatQty(batch.totalRows)} rows`}
                icon={<CheckCircle2 size={18} />}
                color="bg-green-50 dark:bg-green-500/15 text-green-600"
              />
            ) : (
              <StatCard
                title="Ready"
                value={formatQty(batch.validRows)}
                hint={`of ${formatQty(batch.totalRows)} rows`}
                icon={<CheckCircle2 size={18} />}
                color="bg-blue-50 dark:bg-blue-500/15 text-blue-600"
              />
            )}
            <StatCard
              title="Errors"
              value={formatQty(batch.errorRows)}
              hint="Fix in the file and upload again"
              icon={<XCircle size={18} />}
              color="bg-red-50 dark:bg-red-500/15 text-red-500"
            />
            <StatCard
              title="Duplicates"
              value={formatQty(batch.duplicateRows)}
              hint="Already in the CRM; skipped, never overwritten"
              icon={<AlertTriangle size={18} />}
              color="bg-yellow-50 dark:bg-yellow-500/15 text-yellow-600"
            />
            {batch.locationName ? (
              <StatCard
                title="Location"
                value={batch.locationName}
                hint={LOCATION_LABEL[batch.kind]?.hint ?? ""}
                icon={<ListChecks size={18} />}
              />
            ) : (
              <StatCard
                title="Rows in file"
                value={formatQty(batch.totalRows)}
                hint={`${batch.headers.length} columns`}
                icon={<ListChecks size={18} />}
              />
            )}
          </div>

          {batch.summary.length > 0 && (batch.status === "VALIDATED" || batch.status === "IMPORTED") && (
            <Card title={batch.status === "VALIDATED" ? "What approving will do" : "What was imported"}>
              <ul className="list-disc pl-5 space-y-1 text-sm text-muted">
                {batch.summary.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </Card>
          )}

          {batch.status === "VALIDATED" && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
              <p className="text-sm text-muted">
                Approving creates {formatQty(batch.validRows)} {batch.validRows === 1 ? "row" : "rows"} in one go. Errors and duplicates are
                left out.
              </p>
              <div className="flex gap-2 shrink-0">
                <Button variant="secondary" onClick={() => setRemapping(true)}>
                  Change mapping
                </Button>
                <Button disabled={batch.validRows === 0} onClick={() => setConfirm("approve")}>
                  Approve {formatQty(batch.validRows)} {batch.validRows === 1 ? "row" : "rows"}
                </Button>
              </div>
            </div>
          )}

          {batch.status === "IMPORTED" && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
              <p className="text-sm text-muted">
                Imported {formatDateTime(batch.approvedAt)}
                {batch.approvedByName ? ` by ${batch.approvedByName}` : ""}.{" "}
                {batch.rollbackBlocker ? (
                  <span className="text-yellow-700 dark:text-yellow-400">Rollback isn&apos;t possible: {batch.rollbackBlocker}.</span>
                ) : (
                  "It can still be rolled back while nothing it created has been used."
                )}
              </p>
              <Button
                variant="secondary"
                icon={<RotateCcw size={16} />}
                disabled={Boolean(batch.rollbackBlocker)}
                onClick={() => setConfirm("rollback")}
              >
                Roll back
              </Button>
            </div>
          )}

          {batch.status === "ROLLED_BACK" && (
            <div className="rounded-2xl border border-border bg-surface-2 p-4 text-sm text-muted">
              Rolled back {formatDateTime(batch.rolledBackAt)}
              {batch.rolledBackByName ? ` by ${batch.rolledBackByName}` : ""}: {batch.rollbackReason}. {EFFECT[batch.kind].rolledBack}
            </div>
          )}

          <RowsTable batch={batch} />
        </>
      )}

      {confirm === "approve" && (
        <ConfirmDialog
          title={`Import ${formatQty(batch.validRows)} rows?`}
          tone="primary"
          message={`${EFFECT[batch.kind].approve} Rows are checked once more first; if anything changed, nothing is imported.`}
          confirmLabel="Approve import"
          loading={action.isPending}
          onConfirm={() => run("approve")}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === "cancel" && (
        <ConfirmDialog
          title="Cancel this import?"
          message="Nothing from this file has been saved. The upload stays in the history as cancelled."
          confirmLabel="Cancel import"
          loading={action.isPending}
          onConfirm={() => run("cancel")}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === "rollback" && (
        <ConfirmDialog
          title="Roll back this import?"
          message={
            <div className="space-y-3">
              <p>{EFFECT[batch.kind].rollback}</p>
              <Field label="Reason" htmlFor="im-reason" required>
                <Textarea id="im-reason" rows={2} value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
              </Field>
            </div>
          }
          confirmLabel="Roll back"
          confirmDisabled={!reason.trim()}
          loading={action.isPending}
          onConfirm={() => run("rollback")}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
