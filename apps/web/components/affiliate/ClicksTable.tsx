"use client"

import { useEffect } from "react"
import { useAffiliateStore } from "../../store/affiliate.store"

export default function ClicksTable() {
  const { clicks, fetchClicks } = useAffiliateStore()

  useEffect(() => {
    fetchClicks({ page: 1, limit: 10 })
  }, [])

    if (!clicks.length) return (
      <div className="bg-white border rounded-xl p-6 text-center text-muted">
        No clicks yet.
      </div>
    )
  return (
    <div className="bg-white border rounded-xl p-6">
      <h2 className="font-semibold mb-4">Clicks</h2>

      {clicks.map((c: any) => (
        <div key={c.id} className="flex justify-between border-b py-2 text-sm">
          <span>{c.ip}</span>
          <span>{new Date(c.createdAt).toLocaleDateString()}</span>
        </div>
      ))}
    </div>
  )
}