import RequirePermission from "@/components/shell/RequirePermission"
import { PageHeader } from "@/components/ui/Display"
import LinkTabs from "@/components/ui/Tabs"

const tabs = [
  { label: "Business", href: "/settings/business" },
  { label: "Locations", href: "/settings/locations" },
  { label: "Receiving accounts", href: "/settings/accounts" },
  { label: "Couriers", href: "/settings/couriers" },
  { label: "Users & roles", href: "/settings/users" },
  { label: "Integrations", href: "/settings/integrations" },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequirePermission permission="settings.manage">
      <PageHeader title="Settings" subtitle="Business details, stock locations, payment accounts, team access and integrations." />
      <LinkTabs tabs={tabs} />
      {children}
    </RequirePermission>
  )
}
