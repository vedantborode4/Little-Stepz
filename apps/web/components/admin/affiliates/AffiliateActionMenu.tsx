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
        className="text-gray-400 hover:text-gray-700 transition p-1 rounded-lg hover:bg-gray-100"
      >
        <MoreHorizontal size={16} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-gray-100 z-20 overflow-hidden">
          <button
            onClick={() => { router.push(`/admin/affiliates/${affiliate.id}`); setOpen(false) }}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
          >
            <Eye size={14} className="text-gray-400" />
            View Details
          </button>
          {affiliate.status === "PENDING" && (
            <>
              <button
                onClick={() => { onApprove(); setOpen(false) }}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-green-600 hover:bg-green-50 transition"
              >
                <CheckCircle size={14} />
                Approve
              </button>
              <button
                onClick={reject}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition"
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
