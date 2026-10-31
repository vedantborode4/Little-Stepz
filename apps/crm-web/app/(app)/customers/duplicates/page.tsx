import RequirePermission from "@/components/shell/RequirePermission"
import DuplicatesPanel from "@/features/customers/DuplicatesPanel"

export default function CustomerDuplicatesPage() {
  return (
    <RequirePermission permission="customers.merge">
      <DuplicatesPanel />
    </RequirePermission>
  )
}
