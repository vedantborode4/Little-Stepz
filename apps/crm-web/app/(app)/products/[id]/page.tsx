import RequirePermission from "@/components/shell/RequirePermission"
import ProductDetail from "@/features/products/ProductDetail"

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <RequirePermission permission="products.view">
      <ProductDetail id={id} />
    </RequirePermission>
  )
}
