"use client"

import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Circle,
  HandCoins,
  IndianRupee,
  PackageCheck,
  Repeat,
  Sparkles,
  TrendingUp,
  Truck,
  UserCog,
  Users,
  Wallet,
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { PAYMENT_METHOD_LABELS, SALES_CHANNEL_LABELS, type DashboardSalesPeriodDto, type SalesChannel } from "@repo/crm-schema"
import { Card, PageHeader, Skeleton, StatCard } from "@/components/ui/Display"
import { FilterSelect } from "@/components/ui/Toolbar"
import { useStockSummary } from "@/features/inventory/api"
import { useNamedList, useProducts } from "@/features/products/api"
import { useBusinessProfile, useLocations, useReceivingAccounts } from "@/features/settings/api"
import { formatMoney, formatQty } from "@/lib/format"
import { useAuthStore, useCan } from "@/store/auth.store"
import { useDashboard } from "./api"
import { BarList, TrendChart } from "./charts"

const tone = {
  blue: "bg-blue-50 dark:bg-blue-500/15 text-blue-600",
  green: "bg-green-50 dark:bg-green-500/15 text-green-600",
  yellow: "bg-yellow-50 dark:bg-yellow-500/15 text-yellow-600",
  purple: "bg-purple-50 dark:bg-purple-500/15 text-purple-600",
}

function SectionTitle({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{children}</h2>
      {note && <p className="text-xs text-faint">{note}</p>}
    </div>
  )
}

const periodCard = (title: string, p: DashboardSalesPeriodDto) => (
  <StatCard
    title={title}
    value={formatMoney(p.grossSales)}
    hint={`${formatMoney(p.netSales)} excl. GST · ${p.orders} orders`}
    icon={<IndianRupee size={18} />}
  />
)

/** Two figures that make up a whole, as a split bar with both values printed. */
function Split({ title, left, right }: { title: string; left: [string, string]; right: [string, string] }) {
  const a = Number(left[1])
  const b = Number(right[1])
  const share = a + b > 0 ? (a / (a + b)) * 100 : 50
  return (
    <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5">
      <p className="text-sm text-muted font-medium">{title}</p>
      <div className="mt-3 flex h-2 rounded-full overflow-hidden bg-surface-2 gap-0.5" aria-hidden>
        {a > 0 && <div className="bg-primary rounded-full" style={{ width: `${share}%` }} />}
        {b > 0 && <div className="bg-secondary rounded-full flex-1" />}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <span className="size-2 rounded-full bg-primary" /> {left[0]}
          </p>
          <p className="font-semibold text-text tabular mt-0.5">{formatMoney(left[1])}</p>
        </div>
        <div className="text-right">
          <p className="flex items-center justify-end gap-1.5 text-xs text-muted">
            <span className="size-2 rounded-full bg-secondary" /> {right[0]}
          </p>
          <p className="font-semibold text-text tabular mt-0.5">{formatMoney(right[1])}</p>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const user = useAuthStore((s) => s.user)
  const can = useCan()
  const [categoryId, setCategoryId] = useState<string>()
  const [productId, setProductId] = useState<string>()
  const categories = useNamedList("categories")
  const products = useProducts({ categoryId, limit: 100 })
  const { data, isLoading } = useDashboard({ categoryId, productId })
  const stock = useStockSummary()

  const profile = useBusinessProfile()
  const locations = useLocations()
  const accounts = useReceivingAccounts()
  const checklist = [
    { label: "Business profile and GST state", done: !(profile.data?.legalName.includes("SAMPLE") ?? true), href: "/settings/business" },
    { label: "Stock locations (Store, Godown)", done: (locations.data?.length ?? 0) > 0, href: "/settings/locations" },
    { label: "Receiving accounts (cash, UPI, bank)", done: (accounts.data?.length ?? 0) > 0, href: "/settings/accounts" },
  ]
  const setupPending = can("settings.manage") && checklist.some((c) => !c.done)
  const scoped = Boolean(categoryId || productId)
  const scopeName = productId
    ? products.data?.items.find((p) => p.id === productId)?.name
    : categories.data?.find((c) => c.id === categoryId)?.name
  const wholeBusiness = scoped ? "Whole business; product filters don't apply" : undefined

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title={`Welcome, ${user?.name ?? ""}`}
        subtitle="Revenue counts when an order is handed over or dispatched. Money on unfulfilled orders is an advance."
        action={
          <>
            <FilterSelect
              label="Category"
              value={categoryId}
              onChange={(v) => {
                setCategoryId(v)
                setProductId(undefined)
              }}
            >
              <option value="">All categories</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect label="Product" value={productId} onChange={setProductId}>
              <option value="">All products</option>
              {products.data?.items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </FilterSelect>
          </>
        }
      />

      {setupPending && (
        <Card title="Finish setting up" action={<UserCog size={16} className="text-faint" />}>
          <ul className="space-y-1">
            {checklist.map((item) => (
              <li key={item.label}>
                <Link href={item.href} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-2 transition">
                  {item.done ? <CheckCircle2 size={18} className="text-green-500" /> : <Circle size={18} className="text-faint" />}
                  <span className="text-sm text-text flex-1">{item.label}</span>
                  {!item.done && <span className="text-xs text-primary font-semibold">Review</span>}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {isLoading || !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <SectionTitle
              note={scoped ? `${scopeName ?? "Filtered"} only · its lines incl. GST, no shipping` : "Whole business, incl. GST"}
            >
              Sales
            </SectionTitle>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
              <Link href="/sales">{periodCard("Today", data.sales.today)}</Link>
              {periodCard("Yesterday", data.sales.yesterday)}
              {periodCard("This month", data.sales.monthToDate)}
              {periodCard("Lifetime", data.sales.lifetime)}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
              <Split
                title="This month: retail vs wholesale"
                left={["Retail", data.sales.retail]}
                right={["Wholesale", data.sales.wholesale]}
              />
              <Split
                title="This month: store vs online"
                left={["Store & wholesale", data.sales.offline]}
                right={["Online channels", data.sales.online]}
              />
            </div>
          </section>

          {data.payments && (
            <section className="space-y-3">
              <SectionTitle note={wholeBusiness ?? "Received less refunded"}>Payments</SectionTitle>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
                <Link href="/payments">
                  <StatCard
                    title="Collected today"
                    value={formatMoney(data.payments.collectedToday)}
                    hint={`Cash ${formatMoney(data.payments.cashToday)} · UPI ${formatMoney(data.payments.upiToday)}`}
                    icon={<HandCoins size={18} />}
                    color={tone.green}
                  />
                </Link>
                <StatCard
                  title="Gateway today"
                  value={formatMoney(data.payments.gatewayToday)}
                  hint="Card and online gateway receipts"
                  icon={<Wallet size={18} />}
                  color={tone.blue}
                />
                <Link href="/payments/advances">
                  <StatCard
                    title="Advances held"
                    value={formatMoney(data.payments.advances)}
                    hint="Owed to customers until fulfilled; not revenue"
                    icon={<Wallet size={18} />}
                    color={tone.purple}
                  />
                </Link>
                <Link href="/payments/outstanding">
                  <StatCard
                    title="Outstanding"
                    value={formatMoney(data.payments.outstanding)}
                    hint="Still to collect on orders"
                    icon={<AlertTriangle size={18} />}
                    color={tone.yellow}
                  />
                </Link>
              </div>
            </section>
          )}

          {data.profit && (
            <section className="space-y-3">
              <SectionTitle
                note={`${scoped ? `${scopeName ?? "Filtered"} only · ` : ""}Realised this month · projection from today's prices`}
              >
                Profit
              </SectionTitle>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
                <Link href="/analytics/profit">
                  <StatCard
                    title="Gross profit"
                    value={formatMoney(data.profit.grossProfit)}
                    hint={data.profit.marginPercent ? `${data.profit.marginPercent}% of net sales excl. GST` : "Net sales − cost of goods"}
                    icon={<TrendingUp size={18} />}
                    color={tone.green}
                  />
                </Link>
                {data.profit.contributionProfit === null ? (
                  <StatCard
                    title="Net sales this month"
                    value={formatMoney(data.sales.monthToDate.netSales)}
                    hint="Excl. GST, net of returns"
                    icon={<IndianRupee size={18} />}
                    color={tone.blue}
                  />
                ) : (
                  <StatCard
                    title="Contribution profit"
                    value={formatMoney(data.profit.contributionProfit)}
                    hint="After courier, payment fees, order costs and late purchase charges"
                    icon={<TrendingUp size={18} />}
                    color={tone.blue}
                  />
                )}
                <StatCard
                  title="Discounts given"
                  value={formatMoney(data.profit.discounts)}
                  hint="Item and order discounts this month"
                  icon={<IndianRupee size={18} />}
                  color={tone.yellow}
                />
                <Link href="/analytics">
                  <StatCard
                    title="Potential profit"
                    value={formatMoney(data.profit.potentialProfit)}
                    hint={`Projection: ${formatMoney(data.profit.potentialRevenue)} if available stock sells at offer prices`}
                    icon={<Sparkles size={18} />}
                    color={tone.purple}
                  />
                </Link>
              </div>
            </section>
          )}

          <section className="space-y-3">
            <SectionTitle note={scoped ? `${scopeName ?? "Filtered"} only` : undefined}>Inventory</SectionTitle>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
              <StatCard
                title="Products"
                value={formatQty(data.inventory.products)}
                hint={`${formatQty(data.inventory.variants)} active variants`}
                icon={<Boxes size={18} />}
              />
              <StatCard
                title="Available units"
                value={formatQty(data.inventory.available)}
                hint={`${formatQty(data.inventory.reserved)} reserved for orders`}
                icon={<PackageCheck size={18} />}
                color={tone.green}
              />
              <StatCard
                title="Purchased / sold"
                value={`${formatQty(data.inventory.unitsPurchased)} / ${formatQty(data.inventory.unitsSold)}`}
                hint="Units, all time, net of returns"
                icon={<Repeat size={18} />}
                color={tone.blue}
              />
              {data.inventory.costValue !== undefined ? (
                <StatCard
                  title="Stock cost value"
                  value={formatMoney(data.inventory.costValue)}
                  hint="Available units at average landed cost"
                  icon={<Wallet size={18} />}
                  color={tone.purple}
                />
              ) : (
                stock.data && (
                  <Link href="/inventory">
                    <StatCard
                      title="Low / out of stock"
                      value={`${stock.data.lowStock} / ${stock.data.outOfStock}`}
                      hint="Open inventory"
                      icon={<AlertTriangle size={18} />}
                      color={tone.yellow}
                    />
                  </Link>
                )
              )}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-5">
            <Card
              title="Sales, last 30 days"
              className="lg:col-span-2"
              action={<span className="text-xs text-faint">Incl. GST{scoped ? " · filtered" : ""}</span>}
            >
              <TrendChart label="Sales per day incl. GST" data={data.trend.map((t) => ({ date: t.date, value: Number(t.grossSales) }))} />
            </Card>
            {data.collectionsByMethod ? (
              <Card title="Collections this month" action={scoped && <span className="text-xs text-faint">Whole business</span>}>
                <BarList
                  rows={data.collectionsByMethod.map((m) => ({
                    key: m.method,
                    label: PAYMENT_METHOD_LABELS[m.method],
                    value: Number(m.amount),
                    display: formatMoney(m.amount),
                  }))}
                />
              </Card>
            ) : (
              <Card title="Customers & shipping" action={scoped && <span className="text-xs text-faint">Whole business</span>}>
                <CustomerFigures c={data.customers} />
              </Card>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-5">
            <Card title={data.topBy === "variant" ? "Top variants this month" : "Top products this month"}>
              <BarList
                rows={data.topProducts.map((p) => ({
                  key: p.label,
                  label: p.label,
                  value: Number(p.netSales),
                  display: formatMoney(p.netSales),
                  hint: `${formatQty(p.units)} ${p.units === 1 ? "unit" : "units"} · excl. GST`,
                }))}
              />
            </Card>
            <Card title={data.mixBy === "channel" ? "Sales by channel this month" : "Category mix this month"}>
              <BarList
                rows={data.categoryMix.map((c) => ({
                  key: c.label,
                  label: data.mixBy === "channel" ? (SALES_CHANNEL_LABELS[c.label as SalesChannel] ?? c.label) : c.label,
                  value: Number(c.netSales),
                  display: formatMoney(c.netSales),
                }))}
              />
            </Card>
            {data.collectionsByMethod && (
              <Card title="Customers & shipping" action={scoped && <span className="text-xs text-faint">Whole business</span>}>
                <CustomerFigures c={data.customers} />
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function CustomerFigures({
  c,
}: {
  c: { total: number; repeat: number; pendingShipments: number; inTransit: number; delivered: number; returnsAndRto: number }
}) {
  const rows = [
    { icon: <Users size={16} />, label: "Customers", value: c.total, href: "/customers" },
    { icon: <Repeat size={16} />, label: "Repeat buyers", value: c.repeat },
    { icon: <Truck size={16} />, label: "Waiting to ship", value: c.pendingShipments, href: "/shipping" },
    { icon: <Truck size={16} />, label: "In transit", value: c.inTransit, href: "/shipping" },
    { icon: <PackageCheck size={16} />, label: "Delivered", value: c.delivered },
    { icon: <AlertTriangle size={16} />, label: "Returns & RTO this month", value: c.returnsAndRto, href: "/returns" },
  ]
  return (
    <ul className="divide-y divide-border -my-2">
      {rows.map((r) => {
        const body = (
          <>
            <span className="text-faint">{r.icon}</span>
            <span className="text-sm text-text flex-1">{r.label}</span>
            <span className="text-sm font-semibold text-text tabular">{formatQty(r.value)}</span>
          </>
        )
        return (
          <li key={r.label}>
            {r.href ? (
              <Link href={r.href} className="flex items-center gap-3 py-2.5 hover:text-primary">
                {body}
              </Link>
            ) : (
              <div className="flex items-center gap-3 py-2.5">{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
