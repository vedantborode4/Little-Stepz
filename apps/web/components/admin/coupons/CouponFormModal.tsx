"use client"

import { useState } from "react"
import AdminModal from "../AdminModal"
import { AdminCouponService, type AdminCoupon, type CreateCouponBody } from "../../../lib/services/admin-coupon.service"
import { toast } from "sonner"

interface Props {
  mode: "create" | "edit"
  initialData: AdminCoupon | null
  onClose: () => void
  onSuccess: () => void
}

export default function CouponFormModal({ mode, initialData, onClose, onSuccess }: Props) {
  const [form, setForm] = useState<CreateCouponBody>({
    code: initialData?.code ?? "",
    type: initialData?.type ?? "PERCENTAGE",
    value: initialData?.value ?? 0,
    minOrderValue: initialData?.minOrderValue ?? undefined,
    maxDiscount: initialData?.maxDiscount ?? undefined,
    usageLimit: initialData?.usageLimit ?? undefined,
    validFrom: initialData?.validFrom ? initialData.validFrom.split("T")[0] : undefined,
    validUntil: initialData?.validUntil ? initialData.validUntil.split("T")[0] : undefined,
    isActive: initialData?.isActive ?? true,
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.code.trim()) e.code = "Code is required"
    if (form.value <= 0) e.value = "Value must be > 0"
    if (form.type === "PERCENTAGE" && form.value > 100) e.value = "Percentage cannot exceed 100"
    return e
  }

  const submit = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }

    setLoading(true)
    try {
      const body: CreateCouponBody = {
        ...form,
        code: form.code.trim().toUpperCase(),
        // Convert date strings to ISO — backend accepts ISO strings
        validFrom: form.validFrom ? new Date(form.validFrom).toISOString() : undefined,
        validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : undefined,
      }

      if (mode === "create") {
        await AdminCouponService.create(body)
        toast.success("Coupon created")
      } else {
        await AdminCouponService.update(initialData!.id, { ...body, updatedAt: initialData!.updatedAt })
        toast.success("Coupon updated")
      }
      onSuccess()
    } catch (e: any) {
      const msg = e?.response?.data?.message
      toast.error(msg || "Failed to save coupon")
      if (e?.response?.data?.errors) setErrors(e.response.data.errors)
    } finally { setLoading(false) }
  }

  const Field = ({ label, error, children }: any) => (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )

  const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white" />
  )

  return (
    <AdminModal title={mode === "create" ? "Create Coupon" : "Edit Coupon"} onClose={onClose} width="max-w-lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Code *" error={errors.code}>
            <Input
              value={form.code}
              onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
              placeholder="e.g. SAVE20"
              disabled={mode === "edit" && (initialData?.usedCount ?? 0) > 0}
            />
          </Field>

          <Field label="Type">
            <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as any }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              disabled={mode === "edit" && (initialData?.usedCount ?? 0) > 0}>
              <option value="PERCENTAGE">Percentage (%)</option>
              <option value="FLAT">Flat (₹)</option>
            </select>
          </Field>
        </div>

        <Field label={`Discount Value ${form.type === "PERCENTAGE" ? "(%)" : "(₹)"} *`} error={errors.value}>
          <Input type="number" min={0} max={form.type === "PERCENTAGE" ? 100 : undefined}
            value={form.value}
            onChange={e => setForm(p => ({ ...p, value: Number(e.target.value) }))}
            disabled={mode === "edit" && (initialData?.usedCount ?? 0) > 0}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Min Order Value (₹)">
            <Input type="number" min={0} placeholder="Optional"
              value={form.minOrderValue ?? ""}
              onChange={e => setForm(p => ({ ...p, minOrderValue: e.target.value ? Number(e.target.value) : undefined }))} />
          </Field>

          {form.type === "PERCENTAGE" && (
            <Field label="Max Discount (₹)">
              <Input type="number" min={0} placeholder="Optional (cap)"
                value={form.maxDiscount ?? ""}
                onChange={e => setForm(p => ({ ...p, maxDiscount: e.target.value ? Number(e.target.value) : undefined }))} />
            </Field>
          )}

          <Field label="Usage Limit">
            <Input type="number" min={0} placeholder="Leave blank = unlimited"
              value={form.usageLimit ?? ""}
              onChange={e => setForm(p => ({ ...p, usageLimit: e.target.value ? Number(e.target.value) : undefined }))} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Valid From">
            <Input type="date" value={form.validFrom ?? ""}
              onChange={e => setForm(p => ({ ...p, validFrom: e.target.value || undefined }))} />
          </Field>
          <Field label="Valid Until">
            <Input type="date" value={form.validUntil ?? ""}
              onChange={e => setForm(p => ({ ...p, validUntil: e.target.value || undefined }))} />
          </Field>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
            className="w-4 h-4 rounded accent-primary" />
          <span className="text-sm font-medium text-gray-700">Active (coupon can be used)</span>
        </label>

        {mode === "edit" && (initialData?.usedCount ?? 0) > 0 && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-2">
            ⚠ This coupon has been used {initialData?.usedCount} time(s). Type and value cannot be changed.
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Cancel</button>
          <button onClick={submit} disabled={loading}
            className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-60 hover:bg-primary/90">
            {loading ? "Saving…" : mode === "create" ? "Create Coupon" : "Update Coupon"}
          </button>
        </div>
      </div>
    </AdminModal>
  )
}
