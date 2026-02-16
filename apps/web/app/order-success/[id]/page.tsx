export default function OrderSuccessPage({
  params,
}: {
  params: { id: string }
}) {
  return (
    <div className="py-24 text-center space-y-4">
      <h1 className="text-2xl font-bold text-primary">
        🎉 Order Placed Successfully
      </h1>

      <p className="text-muted">Order ID: {params.id}</p>
    </div>
  )
}
