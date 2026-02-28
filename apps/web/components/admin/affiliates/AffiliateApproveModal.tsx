"use client"

import { useState } from "react"
import { toast } from "sonner"
import AdminModal from "../AdminModal"
import { AdminAffiliateService, type AdminAffiliate } from "../../../lib/services/admin-affiliate.service"

interface Props {
  affiliate: AdminAffiliate
  onClose: () => void
  onSuccess: () => void
}

export default function AffiliateApproveModal({ affiliate, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    status: "APPROVED" as "APPROVED" | "REJECTED",
    commissionRate: 10,
    commissionType: "PERCENTAGE" as "PERCENTAGE" | "FLAT",
    adminNote: "",
  })
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    try {
      await AdminAffiliateService.updateStatus(affiliate.id, form)
      toast.success(`Affiliate ${form.status === "APPROVED" ? "approved" : "rejected"} successfully`)
      onSuccess()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Action failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminModal title={`Review Affiliate — ${affiliate.user?.name}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Name</span>
            <span className="font-medium">{affiliate.user?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Email</span>
            <span className="font-medium">{affiliate.user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Applied</span>
            <span className="font-medium">{new Date(affiliate.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Decision */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Decision</label>
          <div className="grid grid-cols-2 gap-2">
            {(["APPROVED", "REJECTED"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setForm((p) => ({ ...p, status: s }))}
                className={`py-2.5 rounded-xl text-sm font-medium border transition ${
                  form.status === s
                    ? s === "APPROVED"
                      ? "bg-green-500 text-white border-green-500"
                      : "bg-red-500 text-white border-red-500"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {s === "APPROVED" ? "✓ Approve" : "✕ Reject"}
              </button>
            ))}
          </div>
        </div>

        {form.status === "APPROVED" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Commission Type</label>
                <select
                  value={form.commissionType}
                  onChange={(e) => setForm((p) => ({ ...p, commissionType: e.target.value as any }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FLAT">Flat (₹)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Rate ({form.commissionType === "PERCENTAGE" ? "%" : "₹"})
                </label>
                <input
                  type="number"
                  value={form.commissionRate}
                  onChange={(e) => setForm((p) => ({ ...p, commissionRate: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  min={0}
                />
              </div>
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Admin Note (optional)</label>
          <textarea
            value={form.adminNote}
            onChange={(e) => setForm((p) => ({ ...p, adminNote: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
            rows={2}
            placeholder="Internal note..."
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60"
          >
            {loading ? "Saving…" : "Confirm"}
          </button>
        </div>
      </div>
    </AdminModal>
  )
}
