"use client"

import { useState } from "react"
import AdminModal from "../AdminModal"
import { AdminAffiliateService, type AdminAffiliate } from "../../../lib/services/admin-affiliate.service"
import { toast } from "sonner"

interface Props {
  affiliate: AdminAffiliate
  /**
   * "approve" — approve a PENDING affiliate
   * "reject"  — reject a PENDING affiliate
   * "edit"    — update commission settings for an APPROVED affiliate
   */
  action: "approve" | "reject" | "edit"
  onClose: () => void
  onSuccess: () => void
}

export default function AffiliateApproveModal({ affiliate, action, onClose, onSuccess }: Props) {
  // commissionRate stored as percentage (e.g. 10 = 10%) for the input
  // backend expects decimal (0.10), so we divide by 100 on submit
  const [commissionRate, setCommissionRate] = useState(
    affiliate.commissionRate <= 1
      ? affiliate.commissionRate * 100   // stored as decimal (0.10) → show as 10
      : affiliate.commissionRate          // already percentage
  )
  const [commissionType, setCommissionType] = useState<"PER_ORDER" | "LIFETIME">(affiliate.commissionType)
  const [adminNote, setAdminNote] = useState(affiliate.adminNote ?? "")
  const [loading, setLoading] = useState(false)

  const isEdit = action === "edit"
  const isApprove = action === "approve"
  const isReject = action === "reject"

  const submit = async () => {
    setLoading(true)
    try {
      if (isApprove) {
        await AdminAffiliateService.approve(affiliate.id, {
          commissionRate: commissionRate / 100,
          commissionType,
          adminNote: adminNote || undefined,
        })
        toast.success("Affiliate approved successfully")
      } else if (isReject) {
        await AdminAffiliateService.reject(affiliate.id, {
          adminNote: adminNote || undefined,
        })
        toast.success("Affiliate rejected")
      } else {
        // edit — update commission settings regardless of status
        await AdminAffiliateService.update(affiliate.id, {
          commissionRate: commissionRate / 100,
          commissionType,
          adminNote: adminNote || undefined,
        })
        toast.success("Affiliate settings updated")
      }
      onSuccess()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || `Failed to ${action} affiliate`)
    } finally {
      setLoading(false)
    }
  }

  const title = isApprove ? "Approve Affiliate" : isReject ? "Reject Affiliate" : "Edit Affiliate Settings"

  return (
    <AdminModal title={title} onClose={onClose} width="max-w-md">
      <div className="space-y-4">
        {/* Affiliate info */}
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="font-semibold text-gray-900">{affiliate.user.name}</p>
          <p className="text-sm text-gray-500">{affiliate.user.email}</p>
          {isEdit && (
            <p className="text-xs text-primary mt-1 font-medium">
              Current: {commissionRate}% · {commissionType}
            </p>
          )}
        </div>

        {/* Commission fields — shown for approve and edit, not reject */}
        {(isApprove || isEdit) && (
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
                onChange={e => setCommissionType(e.target.value as "PER_ORDER" | "LIFETIME")}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
              >
                <option value="LIFETIME">LIFETIME — earns on every order from referred user</option>
                <option value="PER_ORDER">PER_ORDER — earns only on first order</option>
              </select>
            </div>
          </>
        )}

        {/* Admin note — shown to the applicant */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">
            {isReject ? "Reason for rejection" : isApprove ? "Note to applicant" : "Admin Note"}
            <span className="ml-1 text-xs text-gray-400 font-normal">(visible to applicant)</span>
          </label>
          <textarea
            value={adminNote}
            onChange={e => setAdminNote(e.target.value)}
            rows={3}
            placeholder={
              isApprove ? "Welcome message or instructions for the affiliate..." :
              isReject  ? "Let the applicant know why their application was rejected..." :
              "Internal note about this change..."
            }
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-60 transition ${
              isReject ? "bg-red-500 hover:bg-red-600" :
              isEdit   ? "bg-primary hover:bg-primary/90" :
                         "bg-green-500 hover:bg-green-600"
            }`}
          >
            {loading ? "Processing…" :
              isApprove ? "Approve" :
              isReject  ? "Reject" :
                          "Save Changes"}
          </button>
        </div>
      </div>
    </AdminModal>
  )
}
