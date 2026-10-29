import RequirePermission from "@/components/shell/RequirePermission"
import WebsiteMapping from "@/features/products/WebsiteMapping"

export default function VariantMappingPage() {
  return (
    <RequirePermission permission="products.manage">
      <WebsiteMapping />
    </RequirePermission>
  )
}
