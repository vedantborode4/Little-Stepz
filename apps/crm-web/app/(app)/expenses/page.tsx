import RequirePermission from "@/components/shell/RequirePermission"
import ExpensesList from "@/features/finance/ExpensesList"

export default function ExpensesPage() {
  return (
    <RequirePermission permission="expenses.manage">
      <ExpensesList />
    </RequirePermission>
  )
}
