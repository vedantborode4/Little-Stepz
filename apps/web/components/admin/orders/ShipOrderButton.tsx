"use client"

import { AdminOrderService } from "../../../lib/services/admin-order.service"
import { Button } from "@repo/ui/index"

export default function ShipOrderButton({ orderId, refresh }: any) {
  const handleShip = async () => {
    await AdminOrderService.createShipment(orderId)
    refresh()
  }

  return (
    <Button className="bg-indigo-600" onClick={handleShip}>
      Create Shipment
    </Button>
  )
}