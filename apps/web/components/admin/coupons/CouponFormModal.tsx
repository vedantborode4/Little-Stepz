"use client"

import { useState } from "react"
import { toast } from "sonner"
import AdminModal from "../AdminModal"
import { AdminCouponService, type Coupon } from "../../../lib/services/admin-coupon.service"

interface Props {
  initialData?: Coupon | null
  onClose: () => void
  onSuccess: () => void
}

export default function CouponFormModal({ initialData, onClose, onSuccess }: Props) {
  const isEdit = !!initialData
  const [form, setForm] = useState({
    code: initialData?.code ?? "",
    discountType: initialData?.discountType ?? "PERCENTAGE",
    discountValue: initialData?.discountValue ?? 10,
    minOrderAmount: initialData?.minOrderAmount ?? "",
    maxDiscount: initialData?.maxDiscount ?? "",
    usageLimit: initialData?.usageLimit ?? "",
    expiresAt: initialData?.expiresAt ? initialData.expiresAt.split("T")[0] : "",
    isActive: initialData?.isActive ?? true,
  })
  const [loading, setLoading] = useState(false)

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  const submit = async () => {
    if (!form.code.trim()) { toast.error("Coupon code is required"); return }
    if (!form.discountValue) { toast.error("Discount value is required"); return }

    setLoading(true)
    try {
      const payload: any = {
        code: form.code.toUpperCase().trim(),
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        isActive: form.isActive,
        ...(form.minOrderAmount ? { minOrderAmount: Number(form.minOrderAmount) } : {}),
        ...(form.maxDiscount ? { maxDiscount: Number(form.maxDiscount) } : {}),
        ...(form.usageLimit ? { usageLimit: Number(form.usageLimit) } : {}),
        ...(form.expiresAt ? { expiresAt: new Date(form.expiresAt).toISOString() } : {}),
      }

      if (isEdit) {
        await AdminCouponService.update(initialData!.id, payload)
        toast.success("Coupon updated")
      } else {
        await AdminCouponService.create(payload)
        toast.success("Coupon created")
      }
      onSuccess()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to save coupon")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminModal title={isEdit ? "Edit Coupon" : "Create Coupon"} onClose={onClose}>
      <div className="space-y-4">
        {/* Code */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Coupon Code *</label>
          <input
            value={form.code}
            onChange={e => set("code", e.target.value.toUpperCase())}
            placeholder="e.g. SAVE20"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Type + Value */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Discount Type *</label>
            <select
              value={form.discountType}
              onChange={e => set("discountType", e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="PERCENTAGE">Percentage (%)</option>
              <option value="FLAT">Flat Amount (₹)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Value ({form.discountType === "PERCENTAGE" ? "%" : "₹"}) *
            </label>
            <input
              type="number" min={0}
              value={form.discountValue}
              onChange={e => set("discountValue", e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Min Order (₹)</label>
            <input
              type="number" min={0}
              value={form.minOrderAmount}
              onChange={e => set("minOrderAmount", e.target.value)}
              placeholder="Optional"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Max Discount (₹)</label>
            <input
              type="number" min={0}
              value={form.maxDiscount}
              onChange={e => set("maxDiscount", e.target.value)}
              placeholder="Optional"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Usage Limit</label>
            <input
              type="number" min={0}
              value={form.usageLimit}
              onChange={e => set("usageLimit", e.target.value)}
              placeholder="Unlimited"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Expires At</label>
            <input
              type="date"
              value={form.expiresAt}
              onChange={e => set("expiresAt", e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={e => set("isActive", e.target.checked)}
            className="w-4 h-4 rounded accent-primary"
          />
          <span className="text-sm font-medium text-gray-700">Active (visible to customers)</span>
        </label>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={loading}
            className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
            {loading ? "Saving…" : isEdit ? "Update Coupon" : "Create Coupon"}
          </button>
        </div>
      </div>
    </AdminModal>
  )
}
