import RequirePermission from "@/components/shell/RequirePermission"
import ExpenseCategoriesPanel from "@/features/finance/ExpenseCategoriesPanel"

export default function ExpenseCategoriesPage() {
  return (
    <RequirePermission permission="expenses.manage">
      <ExpenseCategoriesPanel />
    </RequirePermission>
  )
}
