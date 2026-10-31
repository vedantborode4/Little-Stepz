import RequirePermission from "@/components/shell/RequirePermission"
import ImportsList from "@/features/imports/ImportsList"

export default function ImportsPage() {
  return (
    <RequirePermission permission="import.manage">
      <ImportsList />
    </RequirePermission>
  )
}
