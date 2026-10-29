import RequirePermission from "@/components/shell/RequirePermission"
import BulkPriceEditor from "@/features/products/BulkPriceEditor"

export default function BulkPricePage() {
  return (
    <RequirePermission permission="products.manage">
      <BulkPriceEditor />
    </RequirePermission>
  )
}
