"use client"

import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type RowData, type VisibilityState } from "@tanstack/react-table"
import clsx from "clsx"
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, Inbox } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { EmptyState, Skeleton } from "./Display"
import Pagination from "./Pagination"

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** API sort key; when set the header becomes a sort toggle. */
    sortKey?: string
    align?: "left" | "right" | "center"
    /** Hidden in the column menu's default view; user can switch it on. */
    defaultHidden?: boolean
    headerClassName?: string
    cellClassName?: string
  }
}

interface Props<T> {
  columns: ColumnDef<T, any>[] // eslint-disable-line @typescript-eslint/no-explicit-any
  data: T[] | undefined
  total: number
  page: number
  limit: number
  sort?: string
  loading?: boolean
  onPageChange: (page: number) => void
  onSortChange?: (sort: string | undefined) => void
  getRowId: (row: T) => string
  onRowClick?: (row: T) => void
  /** Card rendering below `sm`; tables are unreadable on phones. */
  mobileCard?: (row: T) => React.ReactNode
  emptyTitle?: string
  emptyHint?: string
  emptyAction?: React.ReactNode
}

const alignClass = { left: "text-left", right: "text-right", center: "text-center" }

function nextSort(current: string | undefined, key: string): string | undefined {
  if (current === `${key}:asc`) return `${key}:desc`
  if (current === `${key}:desc`) return undefined
  return `${key}:asc`
}

/** Server-driven table in the admin panel's visual language, plus sorting and column visibility. */
export default function DataTable<T>({
  columns,
  data,
  total,
  page,
  limit,
  sort,
  loading,
  onPageChange,
  onSortChange,
  getRowId,
  onRowClick,
  mobileCard,
  emptyTitle = "Nothing here yet",
  emptyHint,
  emptyAction,
}: Props<T>) {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() =>
    Object.fromEntries(columns.filter((c) => c.meta?.defaultHidden && c.id).map((c) => [c.id!, false])),
  )

  const table = useReactTable({
    data: data ?? [],
    columns,
    getRowId,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
  })

  const rows = table.getRowModel().rows
  const visibleColumns = table.getVisibleLeafColumns().length
  const isEmpty = !loading && rows.length === 0
  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="space-y-3">
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="hidden sm:flex justify-end px-3 pt-2">
          <ColumnMenu table={table} />
        </div>

        <div className={clsx("overflow-x-auto", mobileCard && "hidden sm:block")}>
          <table className="w-full text-sm">
            <thead className="bg-surface-2 sticky top-0 z-[1]">
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => {
                    const meta = header.column.columnDef.meta
                    const sortKey = meta?.sortKey
                    const active = sortKey && sort?.startsWith(`${sortKey}:`)
                    const label = header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())
                    return (
                      <th
                        key={header.id}
                        scope="col"
                        aria-sort={active ? (sort?.endsWith(":asc") ? "ascending" : "descending") : undefined}
                        className={clsx(
                          "px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted whitespace-nowrap",
                          alignClass[meta?.align ?? "left"],
                          meta?.headerClassName,
                        )}
                      >
                        {sortKey && onSortChange ? (
                          <button
                            type="button"
                            onClick={() => onSortChange(nextSort(sort, sortKey))}
                            className={clsx(
                              "inline-flex items-center gap-1 font-[inherit] uppercase hover:text-text",
                              active && "text-text",
                            )}
                          >
                            {label}
                            {active ? (
                              sort?.endsWith(":asc") ? (
                                <ArrowUp size={12} />
                              ) : (
                                <ArrowDown size={12} />
                              )
                            ) : (
                              <ArrowUpDown size={12} className="opacity-40" />
                            )}
                          </button>
                        ) : (
                          label
                        )}
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: Math.min(limit, 8) }).map((_, i) => (
                  <tr key={`s${i}`} className="border-t border-border">
                    {Array.from({ length: visibleColumns }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-3 w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))}
              {!loading &&
                rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    className={clsx("border-t border-border hover:bg-surface-2/50 transition-colors", onRowClick && "cursor-pointer")}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta
                      return (
                        <td key={cell.id} className={clsx("px-4 py-3 text-text", alignClass[meta?.align ?? "left"], meta?.cellClassName)}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      )
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {mobileCard && (
          <div className="sm:hidden divide-y divide-border">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-4 space-y-2">
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                ))
              : rows.map((row) => (
                  <div
                    key={row.id}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    className={clsx("p-4", onRowClick && "cursor-pointer active:bg-surface-2")}
                  >
                    {mobileCard(row.original)}
                  </div>
                ))}
          </div>
        )}

        {isEmpty && <EmptyState icon={<Inbox size={22} />} title={emptyTitle} hint={emptyHint} action={emptyAction} />}
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={onPageChange} />
    </div>
  )
}

function ColumnMenu<T>({ table }: { table: ReturnType<typeof useReactTable<T>> }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [open])

  const hideable = table.getAllLeafColumns().filter((c) => c.getCanHide() && typeof c.columnDef.header === "string")
  if (hideable.length < 4) return null

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-text px-2 py-1 rounded-lg hover:bg-surface-2"
      >
        <Columns3 size={14} /> Columns
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-52 bg-surface border border-border rounded-xl shadow-card p-2 z-20">
          {hideable.map((column) => (
            <label key={column.id} className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg hover:bg-surface-2 cursor-pointer">
              <input
                type="checkbox"
                checked={column.getIsVisible()}
                onChange={column.getToggleVisibilityHandler()}
                className="accent-[var(--color-primary)]"
              />
              {column.columnDef.header as string}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
