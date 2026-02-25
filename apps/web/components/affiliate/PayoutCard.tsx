"use client"

import { useState } from "react"
import { useAffiliateStore } from "../../store/affiliate.store"
import { AffiliateService } from "../../lib/services/affiliate.service"
import WithdrawDialog from "./WithdrawDialog"
import { toast } from "sonner"
import { affiliatePayoutDetailsSchema } from "@repo/zod-schema/index"

interface FormState {
  accountHolder: string
  accountNumber: string
  ifsc: string
  bankName: string
  upiId?: string
}

interface InputProps {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
}

export default function PayoutCard() {
  const { profile, fetchAffiliate } = useAffiliateStore()

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  const [form, setForm] = useState<FormState>({
    accountHolder: profile?.payoutDetails?.accountHolder || "",
    accountNumber: profile?.payoutDetails?.accountNumber || "",
    ifsc: profile?.payoutDetails?.ifsc || "",
    bankName: profile?.payoutDetails?.bankName || "",
    upiId: profile?.payoutDetails?.upiId || "",
  })

  const balance = profile?.pendingBalance || 0

  const handleChange = (key: keyof FormState, value: string) => {
    setForm((p) => ({ ...p, [key]: value }))
    setErrors((e) => ({ ...e, [key]: [] }))
  }

  const handleSave = async () => {
    const result = affiliatePayoutDetailsSchema.safeParse(form)

    if (!result.success) {
      setErrors(result.error.flatten().fieldErrors)
      return
    }

    try {
      setSaving(true)

      await AffiliateService.updatePayout(result.data)

      toast.success("Payout details updated")

      await fetchAffiliate()

      setEditing(false)
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to update payout")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white border rounded-xl p-6 space-y-4 h-fit">

      <h2 className="font-semibold text-lg">Payout</h2>

      <div>
        <p className="text-sm text-muted">Available Balance</p>
        <p className="text-2xl font-bold text-primary">₹{balance}</p>
      </div>

      {!editing && (
        <ViewMode profile={profile} onEdit={() => setEditing(true)} />
      )}

      {editing && (
        <div className="space-y-3">

          <Input
            label="Account Holder"
            value={form.accountHolder}
            error={errors.accountHolder?.[0]}
            onChange={(v: string) => handleChange("accountHolder", v)}
          />

          <Input
            label="Account Number"
            value={form.accountNumber}
            error={errors.accountNumber?.[0]}
            onChange={(v: string) => handleChange("accountNumber", v)}
          />

          <Input
            label="IFSC"
            value={form.ifsc}
            error={errors.ifsc?.[0]}
            onChange={(v: string) =>
              handleChange("ifsc", v.toUpperCase())
            }
          />

          <Input
            label="Bank Name"
            value={form.bankName}
            error={errors.bankName?.[0]}
            onChange={(v: string) => handleChange("bankName", v)}
          />

          <Input
            label="UPI ID (optional)"
            value={form.upiId || ""}
            error={errors.upiId?.[0]}
            onChange={(v: string) => handleChange("upiId", v)}
          />

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-primary text-white py-2 rounded-lg"
            >
              {saving ? "Saving..." : "Save"}
            </button>

            <button
              onClick={() => setEditing(false)}
              className="flex-1 border py-2 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <WithdrawDialog balance={balance} />
    </div>
  )
}

/* ---------------- VIEW MODE ---------------- */

function ViewMode({ profile, onEdit }: any) {
  return (
    <div className="text-sm space-y-2">
      <p className="text-muted">Payout Method</p>

      {profile?.payoutDetails ? (
        <div className="font-medium space-y-1">
          <p>{profile.payoutDetails.accountHolder}</p>
          <p>{profile.payoutDetails.bankName}</p>
          <p>•••• {profile.payoutDetails.accountNumber?.slice(-4)}</p>
          <p>{profile.payoutDetails.ifsc}</p>
          {profile.payoutDetails.upiId && <p>{profile.payoutDetails.upiId}</p>}
        </div>
      ) : (
        <p className="text-muted">Not set</p>
      )}

      <button onClick={onEdit} className="text-primary font-medium text-sm">
        {profile?.payoutDetails ? "Edit details" : "Add payout details"}
      </button>
    </div>
  )
}

/* ---------------- INPUT ---------------- */

function Input({ label, value, onChange, error }: InputProps) {
  return (
    <div className="space-y-1 text-sm">
      <p className="text-muted">{label}</p>

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded-lg px-3 py-2"
      />

      {error && <p className="text-red-500 text-xs">{error}</p>}
    </div>
  )
}