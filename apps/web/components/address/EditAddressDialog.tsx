"use client"

import { useState } from "react"
import { updateAddressSchema } from "@repo/zod-schema/index"
import { AddressService } from "../../lib/services/address.service"
import { toast } from "sonner"
import { X, Pencil, Loader2 } from "lucide-react"
import { friendlyError } from "../../lib/errorMessages"
import PhoneVerifyField from "./PhoneVerifyField"

const FIELDS = ["name", "phone", "address", "city", "state", "pincode", "country"]
const LABELS: Record<string, string> = {
  name: "Full Name", phone: "Phone", address: "Address Line",
  city: "City", state: "State", pincode: "Pincode", country: "Country",
}

export default function EditAddressDialog({ address, onUpdated }: any) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({ ...address })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [phoneVerified, setPhoneVerified] = useState(false)

  // Verification is only required when the phone actually CHANGES — mirroring the
  // server rule exactly, so the UI never demands something the server wouldn't. Both
  // clients submit the whole object on edit, so gating on "phone is present" would
  // force an OTP on a legacy customer fixing a typo in their city.
  const phoneChanged = form.phone !== address.phone
  const needsVerification = phoneChanged && !phoneVerified

  const handleChange = (key: string, value: string | boolean) => {
    setForm((p: any) => ({ ...p, [key]: value }))
    setErrors((p) => ({ ...p, [key]: "" }))
  }

  const handleSubmit = async () => {
    if (needsVerification) {
      setErrors((p) => ({ ...p, phone: "Please verify this new phone number first" }))
      return
    }

    const parsed = updateAddressSchema.safeParse(form)

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      parsed.error.issues.forEach((i) => {
        const key = i.path[0]
        if (typeof key === "string") fieldErrors[key] = i.message
      })
      setErrors(fieldErrors)
      return
    }

    try {
      setLoading(true)
      await AddressService.update(address.id, parsed.data)
      toast.success("Address updated")
      setOpen(false)
      onUpdated()
    } catch (e: any) {
      toast.error(friendlyError(e, "Update failed"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        <Pencil size={11} />
        Edit
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface rounded-2xl p-6 w-full max-w-lg space-y-4 relative shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-text">Edit Address</h3>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center hover:bg-surface-3 transition"
              >
                <X size={15} className="text-muted" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {FIELDS.map((field) => (
                <div key={field} className={field === "address" || field === "phone" ? "col-span-2" : ""}>
                  <label className="text-xs font-semibold text-muted mb-1.5 block">{LABELS[field]}</label>
                  {field === "phone" ? (
                    <PhoneVerifyField
                      value={form.phone || ""}
                      onChange={(v) => {
                        handleChange("phone", v)
                        setPhoneVerified(false)
                      }}
                      // An unchanged number is already trusted for this address; only a
                      // new one has to be proven.
                      verified={!phoneChanged || phoneVerified}
                      required={phoneChanged}
                      onVerified={() => setPhoneVerified(true)}
                      error={errors.phone}
                    />
                  ) : (
                    <input
                      className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-faint focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
                      value={form[field] || ""}
                      placeholder={LABELS[field]}
                      onChange={(e) => handleChange(field, e.target.value)}
                    />
                  )}
                  {field !== "phone" && errors[field] && (
                    <p className="text-red-500 dark:text-red-400 text-xs mt-1">{errors[field]}</p>
                  )}
                </div>
              ))}
            </div>

            <label className="flex items-center gap-2.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => handleChange("isDefault", e.target.checked)}
                className="accent-primary w-4 h-4"
              />
              <span className="text-muted font-medium">Set as default address</span>
            </label>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-primary text-white py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? "Updating..." : "Update Address"}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
