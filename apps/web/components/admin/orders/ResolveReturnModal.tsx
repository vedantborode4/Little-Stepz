"use client"

import { useState } from "react"
import { AdminOrderService } from "../../../lib/services/admin-order.service"
import { toast } from "sonner"

interface Props {
  returnId: string
  refresh: () => void
}

export default function ResolveReturnModal({ returnId, refresh }: Props) {
  const [open, setOpen] = useState(false)
  const [action, setAction] = useState<"APPROVE" | "REJECT">("APPROVE")
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    try {
      // PUT /admin/returns/:id/resolve
      await AdminOrderService.resolveReturn(returnId, { action, reason: reason || undefined })
      toast.success(`Return ${action.toLowerCase()}d`)
      setOpen(false)
      refresh()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to resolve return")
    } finally { setLoading(false) }
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="px-3 py-1.5 border border-orange-200 text-orange-600 rounded-lg text-xs font-medium hover:bg-orange-50">
        Resolve Return
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-96">
            <h2 className="text-base font-semibold mb-4 text-gray-900">Resolve Return Request</h2>
            <div className="flex gap-2 mb-4">
              {(["APPROVE", "REJECT"] as const).map(a => (
                <button key={a} onClick={() => setAction(a)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition ${
                    action === a
                      ? a === "APPROVE" ? "bg-green-500 text-white border-green-500" : "bg-red-500 text-white border-red-500"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}>
                  {a === "APPROVE" ? "✓ Approve" : "✗ Reject"}
                </button>
              ))}
            </div>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
              placeholder={action === "REJECT" ? "Reason for rejection..." : "Optional note..."}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
            <div className="flex gap-3">
              <button onClick={() => setOpen(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Cancel</button>
              <button onClick={submit} disabled={loading}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-60 ${action === "APPROVE" ? "bg-green-500" : "bg-red-500"}`}>
                {loading ? "Processing…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
