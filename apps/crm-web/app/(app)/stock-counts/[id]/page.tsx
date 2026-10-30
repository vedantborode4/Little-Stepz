import RequirePermission from "@/components/shell/RequirePermission"
import StockCountSheet from "@/features/stockcounts/StockCountSheet"

export default async function StockCountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <RequirePermission permission="stockcount.perform">
      <StockCountSheet id={id} />
    </RequirePermission>
  )
}
