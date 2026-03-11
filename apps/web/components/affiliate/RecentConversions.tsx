"use client"

import { useEffect, useState } from "react"
import { AffiliateService } from "../../lib/services/affiliate.service"

export default function RecentConversions() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    AffiliateService.getConversions().then((res) => {
      setData(res?.conversions ?? [])
      setLoading(false)
    }).catch(() => {
      setData([])
      setLoading(false)
    })
  }, [])

  if (loading) {
    return <p className="text-muted">Loading conversions…</p>
  }

  if (!data.length) {
    return (
      <div className="bg-white border rounded-xl p-6 text-center text-muted">
        No conversions yet.
      </div>
    )
  }

  return (
    <div className="bg-white border rounded-xl p-6">

      <h2 className="font-semibold mb-4">
        Recent Conversions
      </h2>

      <div className="space-y-3 text-sm">
        {data.map((c) => (
          <div
            key={c.id}
            className="flex justify-between border-b pb-2"
          >
            <span>Order #{c.orderId}</span>
            <span className="text-primary font-medium">
              ₹{c.commission}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}