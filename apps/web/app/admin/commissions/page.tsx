"use client"

import { useEffect, useState } from "react"
import { CheckCircle, DollarSign } from "lucide-react"
import { AdminCommissionService } from "../../../lib/services/admin-affiliate.service"
import TableSkeleton from "../../../components/admin/TableSkeleton"
import AdminPageHeader from "../../../components/admin/AdminPageHeader"
import { toast } from "sonner"

export default function AdminCommissionsPage() {
  const [commissions, setCommissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(1)

  const fetch = async () => {
    setLoading(true)
    try {
      const res = await AdminCommissionService.getAll({ page, limit: 15, ...(statusFilter ? { status: statusFilter } : {}) })
      setCommissions(res.data ?? res ?? [])
    } catch (e: any) {
      if (e?.response?.status !== 404) console.error(e)
      setCommissions([])
    }
    finally { setLoading(false) }
  }

  useEffect(() => { fetch() }, [page, statusFilter])

  const approve = async (id: string) => {
    try {
      await AdminCommissionService.approve(id)
      toast.success("Commission approved")
      fetch()
    } catch { toast.error("Failed") }
  }

  const markPaid = async (id: string) => {
    try {
      await AdminCommissionService.markPaid(id)
      toast.success("Marked as paid")
      fetch()
    } catch { toast.error("Failed") }
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader title="Commissions" subtitle="Manage affiliate commission payouts" />

      <div className="flex gap-2">
        {["", "PENDING", "APPROVED", "PAID"].map((s) => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1) }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${statusFilter === s ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {s || "All"}
          </button>
        ))}
      </div>

      {loading ? <TableSkeleton rows={10} cols={5} /> : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-gray-500 text-left">
                <th className="p-4 font-medium">Commission ID</th>
                <th className="p-4 font-medium">Affiliate</th>
                <th className="p-4 font-medium">Order</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((c: any) => (
                <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                  <td className="p-4 font-mono text-xs text-gray-500">#{c.id.slice(-8)}</td>
                  <td className="p-4 font-medium text-gray-900">{c.affiliate?.user?.name || "—"}</td>
                  <td className="p-4 text-gray-600 font-mono text-xs">#{c.orderId?.slice(-8) || "—"}</td>
                  <td className="p-4 font-semibold text-gray-900">₹{c.amount?.toFixed(2)}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      c.status === "PAID" ? "bg-green-50 text-green-600" :
                      c.status === "APPROVED" ? "bg-blue-50 text-blue-600" :
                      "bg-yellow-50 text-yellow-600"}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="p-4 text-gray-500 text-xs">{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      {c.status === "PENDING" && (
                        <button onClick={() => approve(c.id)}
                          className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-lg hover:bg-green-100 transition font-medium">
                          <CheckCircle size={12} /> Approve
                        </button>
                      )}
                      {c.status === "APPROVED" && (
                        <button onClick={() => markPaid(c.id)}
                          className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition font-medium">
                          <DollarSign size={12} /> Mark Paid
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!commissions.length && (
                <tr><td colSpan={7} className="py-16 text-center text-gray-400">No commissions found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
