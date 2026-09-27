import OrderActions from "./OrderActions"
import ShipOrderButton from "./ShipOrderButton"
import ResolveReturnModal from "./ResolveReturnModal"
import Link from "next/link"

export default function OrderRowActions({ order, refresh }: any) {
  return (
    <div className="flex gap-2 flex-wrap">

      <OrderActions order={order} refresh={refresh} />

      {order.status === "PROCESSING" && (
        <ShipOrderButton orderId={order.id} refresh={refresh} onSuccess={refresh}/>
      )}

      {order.status === "RETURN_REQUESTED" && order.returnId && (
        <ResolveReturnModal returnId={order.returnId} refresh={refresh} />
      )}

      {/* Item returns leave the order DELIVERED, so they need their own entry point. */}
      {order.openReturns > 0 && (
        <Link href={`/admin/orders/${order.id}`}
          className="px-3 py-1.5 border border-orange-200 dark:border-orange-500/30 text-orange-600 dark:text-orange-400 rounded-lg text-xs font-medium hover:bg-orange-50 dark:hover:bg-orange-500/15">
          {order.openReturns} open return{order.openReturns === 1 ? "" : "s"}
        </Link>
      )}

    </div>
  )
}