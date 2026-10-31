import RequirePermission from "@/components/shell/RequirePermission"
import ReturnsList from "@/features/returns/ReturnsList"

export default function ReturnsPage() {
  return (
    <RequirePermission permission="sales.view">
      <ReturnsList />
    </RequirePermission>
  )
}
