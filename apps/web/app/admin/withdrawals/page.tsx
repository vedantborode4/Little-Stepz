"use client"

import { useEffect, useState } from "react"
import { AdminWithdrawalService } from "../../../lib/services/admin-affiliate.service"
import TableSkeleton from "../../../components/admin/TableSkeleton"
import AdminPageHeader from "../../../components/admin/AdminPageHeader"
import AdminModal from "../../../components/admin/AdminModal"
import { toast } from "sonner"

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("")
  const [processing, setProcessing] = useState<any | null>(null)
  const [processForm, setProcessForm] = useState({ status: "APPROVED" as "APPROVED" | "REJECTED", note: "" })
  const [saving, setSaving] = useState(false)

  const fetch = async () => {
    setLoading(true)
    try {
      const res = await AdminWithdrawalService.getAll({ limit: 15, ...(statusFilter ? { status: statusFilter } : {}) })
      setWithdrawals(res.data ?? res ?? [])
    } catch (e: any) {
      if (e?.response?.status !== 404) console.error(e)
      setWithdrawals([])
    }
    finally { setLoading(false) }
  }

  useEffect(() => { fetch() }, [statusFilter])

  const processWithdrawal = async () => {
    setSaving(true)
    try {
      await AdminWithdrawalService.process(processing.id, processForm)
      toast.success(`Withdrawal ${processForm.status.toLowerCase()}`)
      setProcessing(null)
      fetch()
    } catch { toast.error("Failed to process withdrawal") }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader title="Withdrawals" subtitle="Process affiliate payout requests" />

      <div className="flex gap-2">
        {["", "PENDING", "APPROVED", "REJECTED"].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${statusFilter === s ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {s || "All"}
          </button>
        ))}
      </div>

      {loading ? <TableSkeleton rows={8} cols={6} /> : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-gray-500 text-left">
                <th className="p-4 font-medium">Affiliate</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Method</th>
                <th className="p-4 font-medium">Payout Email</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Requested</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((w: any) => (
                <tr key={w.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                  <td className="p-4 font-medium text-gray-900">{w.affiliate?.user?.name || "—"}</td>
                  <td className="p-4 font-bold text-gray-900">₹{w.amount?.toFixed(2)}</td>
                  <td className="p-4 text-gray-600 capitalize">{w.method || "—"}</td>
                  <td className="p-4 text-gray-500 text-xs">{w.payoutEmail || w.affiliate?.user?.email || "—"}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      w.status === "APPROVED" ? "bg-green-50 text-green-600" :
                      w.status === "REJECTED" ? "bg-red-50 text-red-500" :
                      "bg-yellow-50 text-yellow-600"}`}>
                      {w.status}
                    </span>
                  </td>
                  <td className="p-4 text-gray-500 text-xs">{new Date(w.createdAt).toLocaleDateString()}</td>
                  <td className="p-4 text-right">
                    {w.status === "PENDING" && (
                      <button onClick={() => { setProcessing(w); setProcessForm({ status: "APPROVED", note: "" }) }}
                        className="text-xs text-primary font-medium hover:underline">
                        Process
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!withdrawals.length && (
                <tr><td colSpan={7} className="py-16 text-center text-gray-400">No withdrawals found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {processing && (
        <AdminModal title={`Process Withdrawal — ${processing.affiliate?.user?.name}`} onClose={() => setProcessing(null)}>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-bold">₹{processing.amount?.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Method</span><span className="font-medium capitalize">{processing.method}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Payout to</span><span className="font-medium">{processing.payoutEmail}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(["APPROVED", "REJECTED"] as const).map((s) => (
                <button key={s} onClick={() => setProcessForm(p => ({ ...p, status: s }))}
                  className={`py-2.5 rounded-xl text-sm font-medium border transition ${processForm.status === s
                    ? s === "APPROVED" ? "bg-green-500 text-white border-green-500" : "bg-red-500 text-white border-red-500"
                    : "border-gray-200 text-gray-600"}`}>
                  {s === "APPROVED" ? "✓ Approve" : "✕ Reject"}
                </button>
              ))}
            </div>
            <textarea value={processForm.note} onChange={e => setProcessForm(p => ({ ...p, note: e.target.value }))}
              placeholder="Optional note..." rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20" />
            <div className="flex gap-3">
              <button onClick={() => setProcessing(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Cancel</button>
              <button onClick={processWithdrawal} disabled={saving}
                className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
                {saving ? "Processing…" : "Confirm"}
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  )
}
