"use client"

import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Circle,
  CreditCard,
  IndianRupee,
  MapPin,
  Store,
  TrendingUp,
  UserCog,
  Wallet,
} from "lucide-react"
import Link from "next/link"
import { Card, PageHeader, StatCard } from "@/components/ui/Display"
import { useStockSummary } from "@/features/inventory/api"
import { useAdvancesSummary } from "@/features/payments/api"
import { useSalesSummary } from "@/features/sales/api"
import { useBusinessProfile, useLocations, useReceivingAccounts } from "@/features/settings/api"
import { formatMoney, formatQty, todayIST } from "@/lib/format"
import { allNavItems, SHIPPED_PHASE } from "@/lib/nav"
import { useAuthStore, useCan } from "@/store/auth.store"

/** Interim home: setup status and module roadmap until the full KPI dashboard (phase 13). */
export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const can = useCan()
  const profile = useBusinessProfile()
  const locations = useLocations()
  const accounts = useReceivingAccounts()
  const canStock = can("inventory.view")
  const stock = useStockSummary()
  const today = todayIST()
  const sales = useSalesSummary({ from: today, to: today }, can("sales.view"))
  const advances = useAdvancesSummary(can("payments.view"))

  const profileIsSample = profile.data?.legalName.includes("SAMPLE") ?? true
  const checklist = [
    { label: "Business profile and GST state", done: !profileIsSample, href: "/settings/business" },
    { label: "Stock locations (Store, Godown)", done: (locations.data?.length ?? 0) > 0, href: "/settings/locations" },
    { label: "Receiving accounts (cash, UPI, bank)", done: (accounts.data?.length ?? 0) > 0, href: "/settings/accounts" },
  ]

  const upcoming = allNavItems.filter((i) => i.phase > SHIPPED_PHASE).sort((a, b) => a.phase - b.phase)

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader title={`Welcome, ${user?.name ?? ""}`} subtitle="Overview dashboard with live KPIs arrives in phase 13." />

      {sales.data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          <Link href="/sales">
            <StatCard
              title="Today's sales"
              value={formatMoney(sales.data.grossSales)}
              hint={`${sales.data.orders} orders · ${sales.data.units} items, incl. GST`}
              icon={<IndianRupee size={18} />}
            />
          </Link>
          <StatCard
            title="Net sales today"
            value={formatMoney(sales.data.netSales)}
            hint={`Excl. ${formatMoney(sales.data.gst)} GST`}
            icon={<IndianRupee size={18} />}
            color="bg-blue-50 dark:bg-blue-500/15 text-blue-600"
          />
          {sales.data.grossProfit !== undefined && (
            <StatCard
              title="Gross profit today"
              value={formatMoney(sales.data.grossProfit)}
              hint={
                sales.data.unknownCostUnits
                  ? `${sales.data.unknownCostUnits} units with unknown cost left out`
                  : "Net sales − cost of goods"
              }
              icon={<TrendingUp size={18} />}
              color="bg-green-50 dark:bg-green-500/15 text-green-600"
            />
          )}
          {advances.data && (
            <Link href="/payments/advances">
              <StatCard
                title="Advances held"
                value={formatMoney(advances.data.total)}
                hint={`${advances.data.orders} unfulfilled orders · not revenue yet`}
                icon={<Wallet size={18} />}
                color="bg-purple-50 dark:bg-purple-500/15 text-purple-600"
              />
            </Link>
          )}
        </div>
      )}

      {canStock && stock.data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          <StatCard
            title="Available units"
            value={formatQty(stock.data.available)}
            hint={`${formatQty(stock.data.physical)} physical`}
            icon={<Boxes size={18} />}
          />
          <Link href="/inventory">
            <StatCard
              title="Low / out of stock"
              value={`${stock.data.lowStock} / ${stock.data.outOfStock}`}
              hint="Open inventory"
              icon={<AlertTriangle size={18} />}
              color="bg-yellow-50 dark:bg-yellow-500/15 text-yellow-600"
            />
          </Link>
          <StatCard
            title="Variants tracked"
            value={stock.data.variants}
            hint={`${stock.data.damaged} damaged · ${stock.data.demo} demo`}
            icon={<MapPin size={18} />}
            color="bg-blue-50 dark:bg-blue-500/15 text-blue-600"
          />
          {stock.data.stockValue !== undefined && (
            <StatCard
              title="Inventory cost value"
              value={formatMoney(stock.data.stockValue)}
              hint={
                stock.data.unvaluedQty ? `${stock.data.unvaluedQty} units with unknown cost excluded` : "At weighted average landed cost"
              }
              icon={<Wallet size={18} />}
              color="bg-green-50 dark:bg-green-500/15 text-green-600"
            />
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5">
        <StatCard title="Business" value={profile.data?.tradeName ?? "—"} hint={profile.data?.city} icon={<Store size={18} />} />
        <StatCard
          title="Stock locations"
          value={locations.data?.length ?? "—"}
          hint={locations.data?.map((l) => l.name).join(" · ")}
          icon={<MapPin size={18} />}
          color="bg-blue-50 dark:bg-blue-500/15 text-blue-600"
        />
        <StatCard
          title="Receiving accounts"
          value={accounts.data?.length ?? "—"}
          hint="Cash, UPI, gateway and bank"
          icon={<CreditCard size={18} />}
          color="bg-green-50 dark:bg-green-500/15 text-green-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">
        {can("settings.manage") && (
          <Card title="Setup checklist" action={<UserCog size={16} className="text-faint" />}>
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

        <Card title="Module roadmap">
          <ul className="divide-y divide-border">
            {upcoming
              .filter((i) => can(i.permission))
              .map((item) => (
                <li key={item.href} className="flex items-center gap-3 py-2">
                  <item.icon size={16} className="text-faint" />
                  <span className="text-sm text-text flex-1">{item.label}</span>
                  <span className="text-xs text-muted">Phase {item.phase}</span>
                </li>
              ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
