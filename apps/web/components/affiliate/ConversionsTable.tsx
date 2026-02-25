"use client"

import { useAffiliateStore } from "../../store/affiliate.store"

export default function ConversionsTable() {
  const conversions = useAffiliateStore((s) => s.conversions)

  if (!conversions?.length) {
    return (
      <div className="bg-white border rounded-xl p-6 text-center text-muted">
        No conversions yet.
      </div>
    )
  }

  return (
    <div className="bg-white border rounded-xl p-6">
      <h2 className="font-semibold mb-4">Conversions</h2>

      {conversions.map((c: any) => (
        <div
          key={c.id}
          className="flex justify-between border-b py-2 text-sm"
        >
          <span>Order #{c.orderId}</span>
          <span className="text-primary font-medium">
            ₹{c.commission}
          </span>
        </div>
      ))}
    </div>
  )
}