"use client"

import { CheckCircle2, Circle, CreditCard, MapPin, Store, UserCog } from "lucide-react"
import Link from "next/link"
import { Card, PageHeader, StatCard } from "@/components/ui/Display"
import { useBusinessProfile, useLocations, useReceivingAccounts } from "@/features/settings/api"
import { allNavItems, SHIPPED_PHASE } from "@/lib/nav"
import { useAuthStore, useCan } from "@/store/auth.store"

/** Interim home: setup status and module roadmap until the full KPI dashboard (phase 13). */
export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const can = useCan()
  const profile = useBusinessProfile()
  const locations = useLocations()
  const accounts = useReceivingAccounts()

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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5">
        <StatCard title="Business" value={profile.data?.tradeName ?? "—"} hint={profile.data?.city} icon={<Store size={18} />} />
        <StatCard title="Stock locations" value={locations.data?.length ?? "—"} hint={locations.data?.map((l) => l.name).join(" · ")} icon={<MapPin size={18} />} color="bg-blue-50 dark:bg-blue-500/15 text-blue-600" />
        <StatCard title="Receiving accounts" value={accounts.data?.length ?? "—"} hint="Cash, UPI, gateway and bank" icon={<CreditCard size={18} />} color="bg-green-50 dark:bg-green-500/15 text-green-600" />
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
            {upcoming.filter((i) => can(i.permission)).map((item) => (
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
