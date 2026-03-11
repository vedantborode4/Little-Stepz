"use client"

import { useEffect, useState } from "react"
import { AffiliateService } from "../../lib/services/affiliate.service"

export default function CommissionHistory() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    AffiliateService.getCommissions().then((res) => {
      setData(res?.commissions ?? [])
      setLoading(false)
    }).catch(() => {
      setData([])
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="bg-white border rounded-xl p-6">
        Loading commissions…
      </div>
    )
  }

  return (
    <div className="bg-white border rounded-xl p-6">

      <h2 className="font-semibold mb-4">
        Commission History
      </h2>

      {!data.length ? (
        <p className="text-sm text-muted">No commissions yet</p>
      ) : (
        <div className="space-y-3 text-sm">

          {data.map((c) => (
            <div
              key={c.id}
              className="flex justify-between border-b pb-2"
            >
              <div>
                <p className="font-medium">Order #{c.orderId}</p>
                <p className="text-muted text-xs">
                  {new Date(c.createdAt).toLocaleDateString()}
                </p>
              </div>

              <span className="text-primary font-semibold">
                ₹{c.amount}
              </span>
            </div>
          ))}

        </div>
      )}
    </div>
  )
}