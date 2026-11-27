"use client"

import { useParams } from "next/navigation"
import OrderDetailsView from "../../../../components/orders/OrderDetailsView"

export default function OrderDetailsPage() {
  const { id } = useParams<{ id: string }>()
  return <OrderDetailsView orderKey={id} backHref="/account/orders" />
}
