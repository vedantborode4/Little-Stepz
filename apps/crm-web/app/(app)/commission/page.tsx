import RequirePermission from "@/components/shell/RequirePermission"
import CommissionPage from "@/features/commission/CommissionPage"

export default function CommissionRoute() {
  return (
    <RequirePermission permission="commission.manage">
      <CommissionPage />
    </RequirePermission>
  )
}
