import { orderStatusMeta } from "./orderStatusMeta"
import { OrderStatus } from "../../../lib/services/admin-order.service"

export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const meta = orderStatusMeta[status]

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${meta.className}`}>
      {meta.label}
    </span>
  )
}