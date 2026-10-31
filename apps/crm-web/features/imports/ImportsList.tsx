"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { FileUp, Upload } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import {
  IMPORT_BATCH_STATUS_LABELS,
  IMPORT_BATCH_STATUSES,
  IMPORT_FIELDS,
  IMPORT_KIND_LABELS,
  IMPORT_KINDS,
  IMPORT_MAX_BYTES,
  IMPORT_MAX_ROWS,
  type ImportBatchListItemDto,
  type ImportBatchStatus,
  type ImportKind,
} from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import DataTable from "@/components/ui/DataTable"
import { Badge, PageHeader, type BadgeTone } from "@/components/ui/Display"
import { Field, FormError, Input, Select } from "@/components/ui/Form"
import Modal from "@/components/ui/Modal"
import { FilterSelect, ListToolbar, SearchInput } from "@/components/ui/Toolbar"
import { errorMessage, isApiError } from "@/lib/api-error"
import { formatDateTime, formatQty } from "@/lib/format"
import { useListState } from "@/lib/use-list-state"
import { useImports, useUploadImport } from "./api"

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

const TONES: Record<ImportBatchStatus, BadgeTone> = {
  UPLOADED: "blue",
  VALIDATED: "yellow",
  IMPORTED: "green",
  ROLLED_BACK: "gray",
  CANCELLED: "gray",
}

export const ImportStatusBadge = ({ status }: { status: ImportBatchStatus }) => (
  <Badge tone={TONES[status]}>{IMPORT_BATCH_STATUS_LABELS[status]}</Badge>
)

const TOO_LARGE = `The file is larger than ${IMPORT_MAX_BYTES / (1024 * 1024)} MB. In Excel, copy the one sheet you need into a new workbook (or save it as .csv) and upload that.`

function UploadModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const upload = useUploadImport()
  const [kind, setKind] = useState<ImportKind>("PRODUCTS")
  const [file, setFile] = useState<File | null>(null)
  const [sheets, setSheets] = useState<string[] | null>(null)
  const [sheet, setSheet] = useState("")
  const [headerRow, setHeaderRow] = useState("")
  const [error, setError] = useState<string | null>(null)
  const required = IMPORT_FIELDS[kind].filter((f) => f.required).map((f) => f.label)

  const chooseFile = (next: File | null) => {
    setFile(next)
    setSheets(null)
    setSheet("")
    setError(null)
  }

  const submit = async () => {
    setError(null)
    try {
      const batch = await upload.mutateAsync({ kind, file: file!, sheet: sheet || undefined, headerRow: Number(headerRow) || undefined })
      router.push(`/imports/${batch.id}`)
    } catch (err) {
      if (isApiError(err) && err.code === "IMPORT_PICK_SHEET" && Array.isArray(err.details.sheets)) {
        setSheets(err.details.sheets as string[])
        return
      }
      setError(isApiError(err) && err.code === "FILE_TOO_LARGE" ? TOO_LARGE : errorMessage(err))
    }
  }

  return (
    <Modal
      title="Import a file"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={<Upload size={16} />} loading={upload.isPending} disabled={!file || (sheets !== null && !sheet)} onClick={submit}>
            Upload and preview
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={error} />
        <Field label="What does the file contain?" htmlFor="im-kind" required>
          <Select id="im-kind" value={kind} onChange={(e) => setKind(e.target.value as ImportKind)}>
            {IMPORT_KINDS.map((k) => (
              <option key={k} value={k}>
                {IMPORT_KIND_LABELS[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="File"
          htmlFor="im-file"
          required
          hint={`.csv or .xlsx, up to ${IMPORT_MAX_BYTES / (1024 * 1024)} MB and ${formatQty(IMPORT_MAX_ROWS)} rows. Title rows above the column headings are skipped.`}
        >
          <input
            id="im-file"
            type="file"
            accept=".csv,.xlsx"
            onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-muted file:mr-3 file:rounded-xl file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary hover:file:bg-primary/15"
          />
        </Field>
        {sheets && (
          <Field
            label="Which sheet?"
            htmlFor="im-sheet"
            required
            hint={`This workbook has ${sheets.length} sheets; choose the one to import.`}
          >
            <Select id="im-sheet" value={sheet} onChange={(e) => setSheet(e.target.value)}>
              <option value="">Choose a sheet</option>
              {sheets.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Column headings are on row" htmlFor="im-header" hint="Leave blank to find them automatically.">
          <Input
            id="im-header"
            type="number"
            min={1}
            max={100}
            inputMode="numeric"
            value={headerRow}
            onChange={(e) => setHeaderRow(e.target.value)}
            placeholder="Automatic"
          />
        </Field>
        <div className="rounded-xl bg-surface-2 p-3 text-xs text-muted space-y-1">
          <p>
            <span className="font-semibold text-text">Needs columns for:</span> {required.join(", ")}.
          </p>
          <p>
            Nothing is saved until you map the columns, review every row and approve. Missing costs and contact details stay empty; they are
            never guessed.
          </p>
        </div>
      </div>
    </Modal>
  )
}

export default function ImportsList() {
  const router = useRouter()
  const { state, update, params } = useListState<{ kind?: ImportKind; status?: ImportBatchStatus }>()
  const { data, isLoading } = useImports(params)
  const [uploading, setUploading] = useState(false)

  const columns: ColumnDef<ImportBatchListItemDto>[] = [
    { id: "code", header: "Import", cell: ({ row }) => <span className="font-mono text-xs text-primary">{row.original.code}</span> },
    { id: "date", header: "Uploaded", cell: ({ row }) => formatDateTime(row.original.createdAt) },
    { id: "kind", header: "Contents", cell: ({ row }) => IMPORT_KIND_LABELS[row.original.kind] },
    {
      id: "file",
      header: "File",
      cell: ({ row }) => <span className="text-sm truncate max-w-56 inline-block align-bottom">{row.original.fileName}</span>,
    },
    {
      id: "rows",
      header: "Rows",
      meta: { align: "right", cellClassName: "tabular" },
      cell: ({ row }) => {
        const b = row.original
        return b.status === "IMPORTED" || b.status === "ROLLED_BACK" ? `${b.importedRows} of ${b.totalRows} imported` : `${b.totalRows}`
      },
    },
    {
      id: "issues",
      header: "Issues",
      cell: ({ row }) =>
        row.original.errorRows + row.original.duplicateRows > 0 ? (
          <span className="text-xs">
            {row.original.errorRows > 0 && <span className="text-red-500">{plural(row.original.errorRows, "error")}</span>}
            {row.original.errorRows > 0 && row.original.duplicateRows > 0 && " · "}
            {row.original.duplicateRows > 0 && <span className="text-yellow-600">{plural(row.original.duplicateRows, "duplicate")}</span>}
          </span>
        ) : (
          <span className="text-faint">—</span>
        ),
    },
    { id: "by", header: "By", cell: ({ row }) => row.original.createdByName ?? "—" },
    { id: "status", header: "Status", cell: ({ row }) => <ImportStatusBadge status={row.original.status} /> },
  ]

  return (
    <div>
      <PageHeader
        title="Import Data"
        subtitle="Bring in products, opening stock, customers, past sales and expenses from spreadsheets: map columns, review every row, then approve."
        action={
          <Button icon={<FileUp size={16} />} onClick={() => setUploading(true)}>
            Import a file
          </Button>
        }
      />
      <ListToolbar>
        <SearchInput value={state.q} onChange={(q) => update({ q })} placeholder="Import number or file" />
        <FilterSelect
          label="Contents"
          value={state.filters.kind}
          onChange={(kind) => update({ filters: { kind: kind as ImportKind | undefined } })}
        >
          <option value="">All imports</option>
          {IMPORT_KINDS.map((k) => (
            <option key={k} value={k}>
              {IMPORT_KIND_LABELS[k]}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Status"
          value={state.filters.status}
          onChange={(status) => update({ filters: { status: status as ImportBatchStatus | undefined } })}
        >
          <option value="">Any status</option>
          {IMPORT_BATCH_STATUSES.map((s) => (
            <option key={s} value={s}>
              {IMPORT_BATCH_STATUS_LABELS[s]}
            </option>
          ))}
        </FilterSelect>
      </ListToolbar>
      <DataTable
        columns={columns}
        data={data?.items}
        total={data?.total ?? 0}
        page={state.page}
        limit={state.limit}
        loading={isLoading}
        onPageChange={(page) => update({ page })}
        onRowClick={(b) => router.push(`/imports/${b.id}`)}
        getRowId={(b) => b.id}
        emptyTitle="No imports yet"
        emptyHint="Start with products, then opening stock, customers, past sales and expenses."
        mobileCard={(b) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                {b.code} · {IMPORT_KIND_LABELS[b.kind]}
              </p>
              <p className="text-xs text-muted truncate">
                {b.fileName} · {b.totalRows} rows
              </p>
            </div>
            <ImportStatusBadge status={b.status} />
          </div>
        )}
      />
      {uploading && <UploadModal onClose={() => setUploading(false)} />}
    </div>
  )
}
