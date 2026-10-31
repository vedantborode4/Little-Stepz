import RequirePermission from "@/components/shell/RequirePermission"
import ProductsList from "@/features/products/ProductsList"

export default function ProductsPage() {
  return (
    <RequirePermission permission="products.view">
      <ProductsList />
    </RequirePermission>
  )
}
