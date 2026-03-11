"use client"

import { useState } from "react"
import { useAffiliateStore } from "../../store/affiliate.store"
import { AffiliateService } from "../../lib/services/affiliate.service"
import { toast } from "sonner"
import { affiliatePayoutDetailsSchema } from "@repo/zod-schema/index"
import { Wallet, Pencil, ArrowDownToLine } from "lucide-react"

interface FormState {
  accountHolder: string
  accountNumber: string
  ifsc: string
  bankName: string
  upiId?: string
}

export default function PayoutCard() {
  const { profile, fetchAffiliate } = useAffiliateStore()

  const [editing, setEditing]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [amount, setAmount]     = useState("")
  const [errors, setErrors]     = useState<Record<string, string[]>>({})

  const [form, setForm] = useState<FormState>({
    accountHolder: profile?.payoutDetails?.accountHolder || "",
    accountNumber: profile?.payoutDetails?.accountNumber || "",
    ifsc:          profile?.payoutDetails?.ifsc          || "",
    bankName:      profile?.payoutDetails?.bankName      || "",
    upiId:         profile?.payoutDetails?.upiId         || "",
  })

  const balance = profile?.pendingBalance ?? 0

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

  const handleWithdraw = async () => {
    const value = Number(amount)
    if (!value) return toast.error("Enter an amount")
    if (value > balance) return toast.error("Amount exceeds available balance")
    try {
      setWithdrawing(true)
      await AffiliateService.withdraw(value)
      toast.success("Withdrawal requested 🎉")
      setAmount("")
      await fetchAffiliate()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Withdrawal failed")
    } finally {
      setWithdrawing(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Payout</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your bank details and withdraw earnings</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Balance + withdraw */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-50 rounded-xl">
              <Wallet size={20} className="text-orange-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Available Balance</p>
              <p className="text-2xl font-bold text-gray-900">₹{balance.toLocaleString("en-IN")}</p>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100 space-y-3">
            <p className="text-sm font-medium text-gray-700">Request Withdrawal</p>
            <div className="flex gap-2">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                type="number"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                onClick={handleWithdraw}
                disabled={withdrawing || !balance}
                className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition"
              >
                <ArrowDownToLine size={15} />
                {withdrawing ? "Processing…" : "Withdraw"}
              </button>
            </div>
            <p className="text-xs text-gray-400">Minimum ₹100 · Paid to your bank account within 3–5 days</p>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total paid out</span>
              <span className="font-semibold text-gray-900">₹{(profile?.paidOutBalance ?? 0).toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>

        {/* Bank details */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Bank Details</p>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
              >
                <Pencil size={12} />
                {profile?.payoutDetails ? "Edit" : "Add details"}
              </button>
            )}
          </div>

          {!editing && profile?.payoutDetails ? (
            <div className="space-y-2 text-sm">
              {[
                { label: "Account Holder", value: profile.payoutDetails.accountHolder },
                { label: "Bank",           value: profile.payoutDetails.bankName },
                { label: "Account No.",    value: `•••• ${profile.payoutDetails.accountNumber?.slice(-4)}` },
                { label: "IFSC",           value: profile.payoutDetails.ifsc },
                ...(profile.payoutDetails.upiId ? [{ label: "UPI ID", value: profile.payoutDetails.upiId }] : []),
              ].map((row) => (
                <div key={row.label} className="flex justify-between py-1.5 border-b border-gray-50">
                  <span className="text-gray-400">{row.label}</span>
                  <span className="font-medium text-gray-700">{row.value}</span>
                </div>
              ))}
            </div>
          ) : !editing ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-400">No bank details added yet</p>
              <button onClick={() => setEditing(true)} className="mt-2 text-sm text-primary font-medium hover:underline">
                Add now
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {(["accountHolder", "accountNumber", "ifsc", "bankName", "upiId"] as const).map((key) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs text-gray-500 font-medium capitalize">
                    {key === "upiId" ? "UPI ID (optional)" : key.replace(/([A-Z])/g, " $1").trim()}
                  </label>
                  <input
                    value={form[key] || ""}
                    onChange={(e) => handleChange(key, key === "ifsc" ? e.target.value.toUpperCase() : e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  {errors[key]?.[0] && <p className="text-xs text-red-500">{errors[key][0]}</p>}
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-primary text-white py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition"
                >
                  {saving ? "Saving…" : "Save Details"}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="flex-1 border border-gray-200 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
