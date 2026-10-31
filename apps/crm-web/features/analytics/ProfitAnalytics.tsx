"use client"

import clsx from "clsx"
import { AlertTriangle, ShoppingBag, Tag } from "lucide-react"
import { useState } from "react"
import { SALES_CHANNEL_LABELS, type ProfitBreakdownRowDto, type ProfitDimension, type SalesChannel } from "@repo/crm-schema"
import { Card, PageHeader, Skeleton, StatCard } from "@/components/ui/Display"
import { FilterSelect } from "@/components/ui/Toolbar"
import { useNamedList } from "@/features/products/api"
import { formatMoney, formatQty } from "@/lib/format"
import { useProfit, useProfitBreakdown } from "./api"
import DateRangeFilter, { monthToDate, type DateRange } from "./DateRangeFilter"
import { AnalyticsTabs, marginText, Segmented, StaticTable } from "./shared"

type Line = { label: string; amount: string; sign?: "+" | "−"; total?: boolean; note?: string }

/** Profit as a statement: each subtotal follows the lines that make it. */
function Statement({ lines }: { lines: Line[] }) {
  return (
    <dl className="divide-y divide-border -my-2">
      {lines.map((l) => (
        <div key={l.label} className={clsx("flex items-baseline justify-between gap-4 py-2.5", l.total && "font-semibold")}>
          <dt className={clsx("text-sm", l.total ? "text-text" : "text-muted pl-4")}>
            {l.sign && <span className="inline-block w-4 -ml-4 text-faint">{l.sign}</span>}
            {l.label}
            {l.note && <span className="block text-xs text-faint font-normal mt-0.5">{l.note}</span>}
          </dt>
          <dd
            className={clsx(
              "tabular text-sm shrink-0",
              l.total ? "text-text" : "text-muted",
              l.total && Number(l.amount) < 0 && "text-red-500",
            )}
          >
            {formatMoney(l.amount)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

const DIMENSIONS: { value: ProfitDimension; label: string }[] = [
  { value: "product", label: "Product" },
  { value: "variant", label: "Variant" },
  { value: "category", label: "Category" },
  { value: "channel", label: "Channel" },
]

export default function ProfitAnalytics() {
  const [range, setRange] = useState<DateRange>(monthToDate)
  const [by, setBy] = useState<ProfitDimension>("product")
  const [categoryId, setCategoryId] = useState<string>()
  const { data, isLoading } = useProfit(range)
  const breakdown = useProfitBreakdown({ ...range, by, categoryId })
  const categories = useNamedList("categories")

  const label = (r: ProfitBreakdownRowDto) => (by === "channel" ? (SALES_CHANNEL_LABELS[r.label as SalesChannel] ?? r.label) : r.label)

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title="Profit & Analytics"
        subtitle="Management figures from fulfilled orders less returns, at the cost frozen on each sale. Not final accounts."
      />
      <AnalyticsTabs />
      <DateRangeFilter value={range} onChange={setRange} />

      {isLoading || !data ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-5 items-start">
          <Card title="Profit statement" className="lg:col-span-2">
            <Statement
              lines={[
                { label: "Gross sales", amount: data.grossSales, note: "List value charged plus shipping, incl. GST" },
                { label: "Discounts", amount: data.discounts, sign: "−" },
                { label: "Returns", amount: data.returns, sign: "−" },
                { label: "Net sales incl. GST", amount: data.netSalesInclGst, total: true },
                { label: "GST", amount: data.gst, sign: "−" },
                { label: "Net sales excl. GST", amount: data.netSales, total: true },
                { label: "Cost of goods sold", amount: data.cogs, sign: "−" },
                {
                  label: `Gross profit · ${marginText(data.marginPercent)} margin`,
                  amount: data.grossProfit,
                  total: true,
                  note: data.unknownCostUnits ? `Leaves out ${data.unknownCostUnits} units sold with unknown cost` : undefined,
                },
                { label: "Courier cost", amount: data.shippingExpense, sign: "−" },
                { label: "Payment gateway fees", amount: data.paymentFees, sign: "−" },
                { label: "Order expenses (packaging, extra courier)", amount: data.orderExpenses, sign: "−" },
                {
                  label: "Late purchase charges",
                  amount: data.lateCharges,
                  sign: "−",
                  note: "Freight or duty billed after receipt, for units no longer in stock",
                },
                { label: "Contribution profit", amount: data.contributionProfit, total: true },
                { label: "Operating expenses", amount: data.operatingExpenses, sign: "−" },
                {
                  label: "Operating profit",
                  amount: data.operatingProfit,
                  total: true,
                  note: "A management figure; your CA's accounts are final",
                },
              ]}
            />
          </Card>
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 sm:gap-5">
            <StatCard
              title="Orders fulfilled"
              value={formatQty(data.orders)}
              hint={`${formatQty(data.units)} units, net of returns`}
              icon={<ShoppingBag size={18} />}
            />
            <StatCard
              title="Sold below list price"
              value={formatMoney(data.priceReductions)}
              hint="Offer, wholesale and customer prices under the regular price, before discounts"
              icon={<Tag size={18} />}
              color="bg-yellow-50 dark:bg-yellow-500/15 text-yellow-600"
            />
            {data.unknownCostUnits > 0 && (
              <div className="col-span-2 lg:col-span-1 flex gap-3 rounded-2xl border border-yellow-200 dark:border-yellow-500/30 bg-yellow-50 dark:bg-yellow-500/10 p-4 text-sm">
                <AlertTriangle size={18} className="text-yellow-600 shrink-0 mt-0.5" />
                <p className="text-text">
                  {data.unknownCostUnits} units were sold without a known cost. Their sales are counted, but they are left out of gross
                  profit and margin instead of guessing a cost.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <Card
        title="Profit by"
        action={
          <div className="flex flex-wrap items-center gap-2 justify-end">
            {by !== "category" && (
              <FilterSelect label="Category" value={categoryId} onChange={setCategoryId}>
                <option value="">All categories</option>
                {categories.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </FilterSelect>
            )}
            <Segmented label="Group profit by" value={by} options={DIMENSIONS} onChange={setBy} />
          </div>
        }
      >
        {breakdown.isLoading ? (
          <Skeleton className="h-40" />
        ) : (
          <StaticTable
            rows={breakdown.data ?? []}
            rowKey={(r) => r.key}
            empty="No fulfilled sales or returns in this period."
            columns={[
              {
                header: DIMENSIONS.find((d) => d.value === by)!.label,
                cell: (r) => (
                  <div className="min-w-40">
                    <p className="text-text font-medium">{label(r)}</p>
                    {r.sublabel && <p className="text-xs text-faint font-mono">{r.sublabel}</p>}
                  </div>
                ),
              },
              { header: "Units", align: "right", cell: (r) => formatQty(r.units) },
              { header: "Net sales excl. GST", align: "right", cell: (r) => formatMoney(r.netSales) },
              { header: "Discounts", align: "right", cell: (r) => formatMoney(r.discounts) },
              { header: "Cost", align: "right", cell: (r) => formatMoney(r.cogs) },
              {
                header: "Gross profit",
                align: "right",
                cell: (r) => (
                  <span className={clsx("font-semibold", Number(r.grossProfit) < 0 ? "text-red-500" : "text-text")}>
                    {formatMoney(r.grossProfit)}
                  </span>
                ),
              },
              { header: "Margin", align: "right", cell: (r) => marginText(r.marginPercent) },
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
        )}
      </Card>
    </div>
  )
}
