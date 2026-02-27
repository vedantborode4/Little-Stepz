import OrderActions from "./OrderActions"
import ShipOrderButton from "./ShipOrderButton"
import ResolveReturnModal from "./ResolveReturnModal"

export default function OrderRowActions({ order, refresh }: any) {
  return (
    <div className="flex gap-2 flex-wrap">

      <OrderActions order={order} refresh={refresh} />

      {order.status === "PROCESSING" && (
        <ShipOrderButton orderId={order.id} refresh={refresh} />
      )}

      {order.status === "RETURN_REQUESTED" && (
        <ResolveReturnModal returnId={order.returnId} refresh={refresh} />
      )}

    </div>
  )
}