"use client"

import { useEffect } from "react"
import { useParams } from "next/navigation"
import { useOrderStore } from "../../../store/useOrderStore"

export default function OrderDetailsPage() {
  const { id } = useParams()
  const { currentOrder, fetchOrderById, loading } = useOrderStore()

  useEffect(() => {
    fetchOrderById(id as string)
  }, [id])

  if (loading || !currentOrder) return <div>Loading…</div>

  return (
    <div className="space-y-6">

      <div className="border rounded-xl p-6">
        <h2 className="font-semibold text-lg">
          Order #{currentOrder.id}
        </h2>
        <p className="text-sm text-muted">{currentOrder.status}</p>
      </div>

      <div className="border rounded-xl p-6 space-y-3">
        {currentOrder.items.map((item: any) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span>{item.product.name} × {item.quantity}</span>
            <span>₹{item.total}</span>
          </div>
        ))}
      </div>

      <div className="border rounded-xl p-6 flex justify-between font-semibold">
        <span>Total</span>
        <span>₹{currentOrder.total}</span>
      </div>

    </div>
  )
}
