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
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-text">Clicks</h1>
          <p className="text-xs sm:text-sm text-muted mt-0.5">Unique visits from your referral link</p>
        </div>
        <div className="self-start sm:self-auto bg-surface border border-border rounded-xl px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-muted">
          {clicks.length} unique clicks
        </div>
      </div>

      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        {!clicks.length ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-500/15 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <MousePointerClick size={22} className="text-blue-400" />
            </div>
            <p className="text-sm font-medium text-muted">No clicks yet</p>
            <p className="text-xs text-faint mt-1">Share your referral link to start tracking</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 border-b border-border">
                  <tr className="text-muted text-left">
                    <th className="p-4 font-medium">Source</th>
                    <th className="p-4 font-medium">Country</th>
                    <th className="p-4 font-medium">Converted</th>
                    <th className="p-4 font-medium text-right">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {clicks.map((c: any) => (
                    <tr key={c.id} className="border-t border-border hover:bg-surface-2/50 transition">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Globe size={14} className="text-faint shrink-0" />
                          <span className="text-muted truncate max-w-xs">{c.referrer || "Direct"}</span>
                        </div>
                      </td>
                      <td className="p-4 text-muted">{c.country || "—"}</td>
                      <td className="p-4">
                        {c.convertedAt ? (
                          <span className="text-xs bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400 px-2 py-1 rounded-full font-medium">Converted</span>
                        ) : (
                          <span className="text-xs bg-surface-2 text-faint px-2 py-1 rounded-full">Not yet</span>
                        )}
                      </td>
                      <td className="p-4 text-faint text-xs text-right">
                        {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="sm:hidden divide-y divide-border">
              {clicks.map((c: any) => (
                <div key={c.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Globe size={13} className="text-faint shrink-0" />
                      <span className="text-sm text-muted truncate">{c.referrer || "Direct"}</span>
                    </div>
                    {c.convertedAt ? (
                      <span className="text-[11px] bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400 px-2 py-1 rounded-full font-medium shrink-0">Converted</span>
                    ) : (
                      <span className="text-[11px] bg-surface-2 text-faint px-2 py-1 rounded-full shrink-0">Not yet</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-faint">
                    <span>{c.country || "Unknown country"}</span>
                    <span>{new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
