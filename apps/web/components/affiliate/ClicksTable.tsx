"use client"

import { useEffect } from "react"
import { useAffiliateStore } from "../../store/affiliate.store"
import { MousePointerClick, Globe } from "lucide-react"

export default function ClicksTable() {
  const { clicks, fetchClicks } = useAffiliateStore()

  useEffect(() => {
    fetchClicks({ page: 1, limit: 50, unique: true })
  }, [])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Clicks</h1>
          <p className="text-sm text-gray-500 mt-0.5">Unique visits from your referral link</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium text-gray-700">
          {clicks.length} unique clicks
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {!clicks.length ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <MousePointerClick size={22} className="text-blue-400" />
            </div>
            <p className="text-sm font-medium text-gray-700">No clicks yet</p>
            <p className="text-xs text-gray-400 mt-1">Share your referral link to start tracking</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-gray-500 text-left">
                <th className="p-4 font-medium">Source</th>
                <th className="p-4 font-medium">Country</th>
                <th className="p-4 font-medium">Converted</th>
                <th className="p-4 font-medium text-right">Date</th>
              </tr>
            </thead>
            <tbody>
              {clicks.map((c: any) => (
                <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50/50 transition">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Globe size={14} className="text-gray-300 shrink-0" />
                      <span className="text-gray-700 truncate max-w-xs">{c.referrer || "Direct"}</span>
                    </div>
                  </td>
                  <td className="p-4 text-gray-500">{c.country || "—"}</td>
                  <td className="p-4">
                    {c.convertedAt ? (
                      <span className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded-full font-medium">Converted</span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-400 px-2 py-1 rounded-full">Not yet</span>
                    )}
                  </td>
                  <td className="p-4 text-gray-400 text-xs text-right">
                    {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
