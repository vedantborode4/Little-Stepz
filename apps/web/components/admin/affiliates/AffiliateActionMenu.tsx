"use client"

import { useState, useRef, useEffect } from "react"
import { MoreHorizontal, CheckCircle, XCircle, Eye } from "lucide-react"
import { useRouter } from "next/navigation"
import type { AdminAffiliate } from "../../../lib/services/admin-affiliate.service"
import { AdminAffiliateService } from "../../../lib/services/admin-affiliate.service"
import { toast } from "sonner"

interface Props {
  affiliate: AdminAffiliate
  onApprove: () => void
  onRefresh: () => void
}

export default function AffiliateActionMenu({ affiliate, onApprove, onRefresh }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const reject = async () => {
    try {
      await AdminAffiliateService.reject(affiliate.id, {})
      toast.success("Affiliate rejected")
      onRefresh()
    } catch {
      toast.error("Failed to reject affiliate")
    }
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="text-faint hover:text-muted transition p-1 rounded-lg hover:bg-surface-2"
      >
        <MoreHorizontal size={16} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-surface rounded-xl shadow-lg border border-border z-20 overflow-hidden">
          <button
            onClick={() => { router.push(`/admin/affiliates/${affiliate.id}`); setOpen(false) }}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-muted hover:bg-surface-2 transition"
          >
            <Eye size={14} className="text-faint" />
            View Details
          </button>
          {affiliate.status === "PENDING" && (
            <>
              <button
                onClick={() => { onApprove(); setOpen(false) }}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/15 transition"
              >
                <CheckCircle size={14} />
                Approve
              </button>
              <button
                onClick={reject}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15 transition"
              >
                <XCircle size={14} />
                Reject
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
