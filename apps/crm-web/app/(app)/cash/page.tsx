import RequirePermission from "@/components/shell/RequirePermission"
import CashClosing from "@/features/finance/CashClosing"

export default function CashPage() {
  return (
    <RequirePermission permission="cash.close">
      <CashClosing />
    </RequirePermission>
  )
}
