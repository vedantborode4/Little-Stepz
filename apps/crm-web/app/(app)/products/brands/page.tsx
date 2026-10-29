import RequirePermission from "@/components/shell/RequirePermission"
import { PageHeader } from "@/components/ui/Display"
import CatalogTabs from "@/features/products/CatalogTabs"
import NamedEntityPanel from "@/features/products/NamedEntityPanel"

export default function BrandsPage() {
  return (
    <RequirePermission permission="products.view">
      <PageHeader title="Products" subtitle="Brands you stock, e.g. MJX, YEGAO, Hot Wheels." />
      <CatalogTabs />
      <NamedEntityPanel kind="brands" />
    </RequirePermission>
  )
}
