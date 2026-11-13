import RequirePermission from "@/components/shell/RequirePermission"
import MyCommissionPage from "@/features/commission/MyCommissionPage"

export default function MyCommissionRoute() {
  return (
    <RequirePermission permission="commission.view.own">
      <MyCommissionPage />
    </RequirePermission>
  )
}
