"use client"

import { useState } from "react"
import AdminModal from "../AdminModal"
import { AdminAffiliateService, type AdminAffiliate } from "../../../lib/services/admin-affiliate.service"
import { toast } from "sonner"

interface Props {
  affiliate: AdminAffiliate
  action: "approve" | "reject"
  onClose: () => void
  onSuccess: () => void
}

export default function AffiliateApproveModal({ affiliate, action, onClose, onSuccess }: Props) {
  const [commissionRate, setCommissionRate] = useState(affiliate.commissionRate * 100)
  const [commissionType, setCommissionType] = useState<"PER_ORDER" | "LIFETIME">(affiliate.commissionType)
  const [adminNote, setAdminNote] = useState("")
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    try {
      if (action === "approve") {
        await AdminAffiliateService.approve(affiliate.id, {
          commissionRate: commissionRate / 100,
          commissionType,
          adminNote: adminNote || undefined,
        })
        toast.success("Affiliate approved successfully")
      } else {
        await AdminAffiliateService.reject(affiliate.id, {
          adminNote: adminNote || undefined,
        })
        toast.success("Affiliate rejected")
      }
      onSuccess()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || `Failed to ${action} affiliate`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminModal
      title={action === "approve" ? "Approve Affiliate" : "Reject Affiliate"}
      onClose={onClose}
      width="max-w-md"
    >
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="font-semibold text-gray-900">{affiliate.user.name}</p>
          <p className="text-sm text-gray-500">{affiliate.user.email}</p>
        </div>

        {action === "approve" && (
          <>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Commission Rate (%)</label>
              <input
                type="number" min={1} max={20} step={0.5}
                value={commissionRate}
                onChange={e => setCommissionRate(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="text-xs text-gray-400">Between 1% and 20%</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Commission Type</label>
              <select
                value={commissionType}
                onChange={e => setCommissionType(e.target.value as any)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="LIFETIME">LIFETIME — earns on every order from referred user</option>
                <option value="PER_ORDER">PER_ORDER — earns only on first order</option>
              </select>
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Admin Note (optional)</label>
          <textarea
            value={adminNote}
            onChange={e => setAdminNote(e.target.value)}
            rows={3}
            placeholder={action === "approve" ? "Welcome message or instructions..." : "Reason for rejection..."}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-60 transition ${
              action === "approve" ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"
            }`}
          >
            {loading ? "Processing…" : action === "approve" ? "Approve" : "Reject"}
          </button>
        </div>
      </div>
    </AdminModal>
  )
}
