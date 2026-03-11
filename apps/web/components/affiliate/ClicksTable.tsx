"use client"

import { useEffect } from "react"
import { useAffiliateStore } from "../../store/affiliate.store"

export default function ClicksTable() {
  const { clicks, fetchClicks } = useAffiliateStore()

  useEffect(() => {
    fetchClicks({ page: 1, limit: 50, unique: true })
  }, [])

  if (!clicks.length) return (
    <div className="bg-white border rounded-xl p-6 text-center text-muted">
      No clicks yet.
    </div>
  )

  return (
    <div className="bg-white border rounded-xl p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold">Clicks <span className="text-sm font-normal text-gray-400">(unique visits)</span></h2>
        <span className="text-sm text-gray-400">{clicks.length} total</span>
      </div>

      {clicks.map((c: any) => (
        <div key={c.id} className="flex justify-between border-b py-2 text-sm">
          <span className="text-gray-500 truncate max-w-xs">{c.referrer || "Direct"}</span>
          <span className="text-gray-400">{new Date(c.createdAt).toLocaleDateString()}</span>
        </div>
      ))}
    </div>
  )
}