import RequirePermission from "@/components/shell/RequirePermission"
import ShippingBoard from "@/features/shipping/ShippingBoard"

export default function ShippingPage() {
  return (
    <RequirePermission permission="shipping.manage">
      <ShippingBoard />
    </RequirePermission>
  )
}
