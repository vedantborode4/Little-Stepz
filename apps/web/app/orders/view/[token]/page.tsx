"use client"

import { useParams } from "next/navigation"
import OrderDetailsView from "../../../../components/orders/OrderDetailsView"

/** The private link from order emails: one order, no sign-in (guest checkout). */
export default function OrderViewPage() {
  const { token } = useParams<{ token: string }>()
  return <OrderDetailsView orderKey={`view/${token}`} backHref={null} />
}
