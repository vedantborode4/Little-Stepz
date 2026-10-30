"use client"

import { AlertTriangle, Boxes, Tag, Wallet } from "lucide-react"
import { useState } from "react"
import type { ValuationScenarioDto } from "@repo/crm-schema"
import { Card, PageHeader, Skeleton, StatCard } from "@/components/ui/Display"
import { FilterSelect, ListToolbar, SearchInput } from "@/components/ui/Toolbar"
import { useNamedList } from "@/features/products/api"
import { useLocations } from "@/features/settings/api"
import { formatMoney, formatQty } from "@/lib/format"
import { useValuation } from "./api"
import { AnalyticsTabs, marginText, StaticTable } from "./shared"

const VISIBLE_ROWS = 200

function Scenario({ title, s, note }: { title: string; s: ValuationScenarioDto; note: string }) {
  return (
    <Card title={title} action={<span className="text-xs text-faint">Projection</span>}>
      <dl className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <dt className="text-xs text-muted">If all available stock sells</dt>
          <dd className="text-2xl font-bold text-text tabular">{formatMoney(s.revenue)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Profit net of GST</dt>
          <dd className="font-semibold text-text tabular">{formatMoney(s.profitNetOfGst)}</dd>
          <dd className="text-xs text-faint">{marginText(s.marginPercent)} margin</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Price − cost, GST included</dt>
          <dd className="font-semibold text-text tabular">{formatMoney(s.profitBeforeGst)}</dd>
          <dd className="text-xs text-faint">As often quoted; GST is not yours</dd>
        </div>
      </dl>
      <p className="text-xs text-faint mt-4">{note}</p>
    </Card>
  )
}

export default function Valuation() {
  const [q, setQ] = useState("")
  const [categoryId, setCategoryId] = useState<string>()
  const [locationId, setLocationId] = useState<string>()
  const { data, isLoading } = useValuation({ q: q.trim() || undefined, categoryId, locationId })
  const categories = useNamedList("categories")
  const locations = useLocations()

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title="Profit & Analytics"
        subtitle="What unsold, available stock cost and could bring in at today's prices. Change a price and the projection moves; past sales never do."
      />
      <AnalyticsTabs />
      <ListToolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search product or SKU" />
        <FilterSelect label="Location" value={locationId} onChange={setLocationId}>
          <option value="">All locations</option>
          {locations.data?.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Category" value={categoryId} onChange={setCategoryId}>
          <option value="">All categories</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </FilterSelect>
      </ListToolbar>

      {isLoading || !data ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
            <StatCard
              title="Available units"
              value={formatQty(data.units)}
              hint="Sellable stock not reserved for orders"
              icon={<Boxes size={18} />}
            />
            <StatCard
              title="Cost value"
              value={formatMoney(data.costValue)}
              hint="At weighted average landed cost"
              icon={<Wallet size={18} />}
              color="bg-green-50 dark:bg-green-500/15 text-green-600"
            />
            <StatCard
              title="Unknown cost"
              value={`${formatQty(data.unknownCostUnits)} units`}
              hint="Not valued and left out of profit projections"
              icon={<AlertTriangle size={18} />}
              color="bg-yellow-50 dark:bg-yellow-500/15 text-yellow-600"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-5">
            <Scenario title="At regular prices" s={data.regular} note="Every available unit sold at its current regular price." />
            <Scenario
              title="At offer prices"
              s={data.offer}
              note="Units with an offer price sold at that price; the rest at their regular price."
            />
          </div>

          <Card title="By variant" action={<Tag size={16} className="text-faint" />}>
            <StaticTable
              rows={data.rows.slice(0, VISIBLE_ROWS)}
              rowKey={(r) => r.variantId}
              empty="No available stock matches these filters."
              columns={[
                {
                  header: "Item",
                  cell: (r) => (
                    <div className="min-w-48">
                      <p className="text-text font-medium">
                        {r.productName} — {r.variantName}
                      </p>
                      <p className="text-xs text-faint font-mono">{r.sku}</p>
                    </div>
                  ),
                },
                { header: "Available", align: "right", cell: (r) => formatQty(r.available) },
                {
                  header: "Avg cost",
                  align: "right",
                  cell: (r) => (r.avgCost ? formatMoney(r.avgCost) : <span className="text-faint">Unknown</span>),
                },
                { header: "Cost value", align: "right", cell: (r) => formatMoney(r.costValue) },
                { header: "Regular", align: "right", cell: (r) => formatMoney(r.regularPrice) },
                { header: "Profit at regular", align: "right", cell: (r) => formatMoney(r.regular.profitNetOfGst) },
                {
                  header: "Offer",
                  align: "right",
                  cell: (r) => (r.offerPrice ? formatMoney(r.offerPrice) : <span className="text-faint">—</span>),
                },
                { header: "Profit at offer", align: "right", cell: (r) => formatMoney(r.offer.profitNetOfGst) },
                {
                  header: "Unknown cost",
                  align: "right",
                  cell: (r) =>
                    r.unknownCostUnits ? (
                      <span className="text-yellow-600">{r.unknownCostUnits} units</span>
                    ) : (
                      <span className="text-faint">—</span>
                    ),
                },
              ]}
            />
            {data.rows.length > VISIBLE_ROWS && (
              <p className="text-xs text-muted mt-3">
                Showing {VISIBLE_ROWS} of {formatQty(data.rows.length)} variants. Search or filter to narrow down, or export the Potential
                profit report.
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
