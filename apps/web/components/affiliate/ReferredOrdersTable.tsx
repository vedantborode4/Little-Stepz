"use client"

import { useEffect } from "react"
import { useAffiliateStore } from "../../store/affiliate.store"

export default function ReferredOrdersTable() {
  const { orders, fetchOrders } = useAffiliateStore()

  useEffect(() => {
    fetchOrders({ page: 1, limit: 10 })
  }, [])

  return (
    <div className="bg-white border rounded-xl p-6">
      <h2 className="font-semibold mb-4">Referred Orders</h2>

      {orders.map((o: any) => (
        <div key={o.id} className="border-b py-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span>#{o.id}</span>
            <span>{o.status}</span>
          </div>

          <div className="flex justify-between text-muted">
            <span>₹{o.total}</span>
            <span>{o.payment?.status}</span>
          </div>

          {o.commissions?.map((c: any) => (
            <div key={c.status} className="text-primary">
              Commission: ₹{c.amount}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}