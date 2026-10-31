"use client"

import clsx from "clsx"
import { FileSpreadsheet, X } from "lucide-react"
import { useMemo, useState } from "react"
import type { ReportDefinitionDto, ReportKey } from "@repo/crm-schema"
import { Card, EmptyState, PageHeader, Skeleton } from "@/components/ui/Display"
import { Select } from "@/components/ui/Form"
import { ExportMenu, FilterSelect } from "@/components/ui/Toolbar"
import CustomerPicker from "@/features/customers/CustomerPicker"
import { useNamedList } from "@/features/products/api"
import { useLocations } from "@/features/settings/api"
import { downloadExport } from "@/lib/download"
import { formatQty } from "@/lib/format"
import { useReportPreview, useReports } from "./api"
import DateRangeFilter, { monthToDate, type DateRange } from "./DateRangeFilter"

const whole = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 })
const decimal = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** A column with any paise in it is money: every value in it then shows two decimals. */
const moneyColumns = (rows: (string | number | boolean | null)[][]) =>
  rows[0]!.map((_, i) => rows.some((r) => typeof r[i] === "number" && !Number.isInteger(r[i])))

function cell(value: string | number | boolean | null, money: boolean) {
  if (value === null || value === "") return <span className="text-faint">—</span>
  if (typeof value === "number") return (money ? decimal : whole).format(value)
  if (typeof value === "boolean") return value ? "Yes" : "No"
  return value
}

function groupBy(reports: ReportDefinitionDto[]) {
  const groups = new Map<string, ReportDefinitionDto[]>()
  for (const r of reports) groups.set(r.group, [...(groups.get(r.group) ?? []), r])
  return [...groups.entries()]
}

export default function Reports() {
  const reports = useReports()
  const [selected, setSelected] = useState<ReportKey | null>(null)
  const [range, setRange] = useState<DateRange>(monthToDate)
  const [locationId, setLocationId] = useState<string>()
  const [categoryId, setCategoryId] = useState<string>()
  const [customer, setCustomer] = useState<{ id: string; name: string } | null>(null)
  const locations = useLocations()
  const categories = useNamedList("categories")

  const groups = useMemo(() => groupBy(reports.data ?? []), [reports.data])
  const active = reports.data?.find((r) => r.key === selected) ?? reports.data?.[0]
  const has = (f: ReportDefinitionDto["filters"][number]) => active?.filters.includes(f) ?? false
  const params = {
    ...(has("dateRange") && range),
    ...(has("location") && { locationId }),
    ...(has("category") && { categoryId }),
    ...(has("customer") && { customerId: customer?.id }),
  }
  const preview = useReportPreview(active?.key ?? null, params)
  const money = useMemo(() => (preview.data?.rows.length ? moneyColumns(preview.data.rows) : []), [preview.data])

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader title="Reports" subtitle="Preview any report, then export every matching row. Customer phone numbers are masked." />

      {reports.isLoading ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : !active ? (
        <EmptyState title="No reports available" hint="Your role doesn't include any reports." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 sm:gap-5 items-start">
          <div className="lg:hidden">
            <Select aria-label="Report" value={active.key} onChange={(e) => setSelected(e.target.value as ReportKey)}>
              {groups.map(([group, list]) => (
                <optgroup key={group} label={group}>
                  {list.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>
          <nav
            aria-label="Reports"
            className="hidden lg:block bg-surface border border-border rounded-2xl p-3 space-y-4 lg:sticky lg:top-4"
          >
            {groups.map(([group, list]) => (
              <div key={group}>
                <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-faint">{group}</p>
                <ul className="space-y-0.5">
                  {list.map((r) => (
                    <li key={r.key}>
                      <button
                        type="button"
                        onClick={() => setSelected(r.key)}
                        aria-current={r.key === active.key ? "page" : undefined}
                        className={clsx(
                          "w-full text-left px-2.5 py-2 rounded-xl text-sm transition",
                          r.key === active.key ? "bg-primary text-white font-medium" : "text-text hover:bg-primary/5",
                        )}
                      >
                        {r.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className="lg:col-span-3 space-y-4 min-w-0">
            <Card
              title={active.title}
              action={<ExportMenu onExport={(format) => downloadExport(`/reports/${active.key}`, params, format)} />}
            >
              <p className="text-sm text-muted">{active.description}</p>
              {active.filters.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {has("dateRange") && <DateRangeFilter value={range} onChange={setRange} />}
                  {has("location") && (
                    <FilterSelect label="Location" value={locationId} onChange={setLocationId}>
                      <option value="">All locations</option>
                      {locations.data?.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </FilterSelect>
                  )}
                  {has("category") && (
                    <FilterSelect label="Category" value={categoryId} onChange={setCategoryId}>
                      <option value="">All categories</option>
                      {categories.data?.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </FilterSelect>
                  )}
                  {has("customer") &&
                    (customer ? (
                      <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-2 pl-3 pr-1.5 h-9 text-sm">
                        {customer.name}
                        <button
                          type="button"
                          aria-label="Clear customer"
                          onClick={() => setCustomer(null)}
                          className="p-1 rounded-lg hover:bg-surface-3"
                        >
                          <X size={14} />
                        </button>
                      </span>
                    ) : (
                      <div className="w-full sm:w-64">
                        <CustomerPicker placeholder="Any customer" onPick={(c) => setCustomer({ id: c.id, name: c.name })} />
                      </div>
                    ))}
                </div>
              )}
            </Card>

            <section className="bg-surface border border-border rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-border">
                <h2 className="text-sm font-semibold text-text">Preview</h2>
                {preview.data && (
                  <p className="text-xs text-muted">
                    {preview.data.truncated
                      ? `First ${formatQty(preview.data.rows.length)} of ${formatQty(preview.data.total)} rows · export for all`
                      : `${formatQty(preview.data.total)} rows`}
                  </p>
                )}
              </div>
              {preview.isLoading || !preview.data ? (
                <div className="p-5">
                  <Skeleton className="h-48" />
                </div>
              ) : preview.data.rows.length === 0 ? (
                <EmptyState icon={<FileSpreadsheet size={22} />} title="No rows" hint="Nothing matches these filters." />
              ) : (
                <div className={clsx("overflow-auto max-h-[65vh]", preview.isFetching && "opacity-60")}>
                  <table className="w-full text-sm">
                    <thead className="bg-surface-2 sticky top-0">
                      <tr>
                        {preview.data.columns.map((c, i) => (
                          <th
                            key={c}
                            className={clsx(
                              "px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted whitespace-nowrap",
                              typeof preview.data.rows[0]![i] === "number" ? "text-right" : "text-left",
                            )}
                          >
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {preview.data.rows.map((row, r) => (
                        <tr key={r} className="hover:bg-surface-2/50">
                          {row.map((v, i) => (
                            <td key={i} className={clsx("px-3 py-2 whitespace-nowrap", typeof v === "number" && "text-right tabular")}>
                              {cell(v, money[i] ?? false)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
