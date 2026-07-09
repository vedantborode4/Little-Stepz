"use client"

import { useState } from "react"
import { AddressService } from "../../lib/services/address.service"
import { createAddressSchema } from "@repo/zod-schema/index"
import { toast } from "sonner"
import { X, Plus, Loader2 } from "lucide-react"

const FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: "name", label: "Full Name", placeholder: "Recipient's full name" },
  { key: "phone", label: "Phone", placeholder: "10-digit phone number" },
  { key: "address", label: "Address Line", placeholder: "House no., Street, Area" },
  { key: "city", label: "City", placeholder: "City" },
  { key: "state", label: "State", placeholder: "State" },
  { key: "pincode", label: "Pincode", placeholder: "6-digit pincode" },
  { key: "country", label: "Country", placeholder: "Country" },
]

export default function AddressFormDialog({ onCreated }: any) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    name: "", phone: "", address: "", city: "", state: "", pincode: "", country: "India", isDefault: false,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (key: keyof typeof form, value: any) => {
    setForm((p) => ({ ...p, [key]: value }))
    setErrors((p) => ({ ...p, [key]: "" }))
  }

  const handleSubmit = async () => {
    const parsed = createAddressSchema.safeParse(form)

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
      await AddressService.create(parsed.data)
      toast.success("Address added")
      setOpen(false)
      onCreated()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 border border-border rounded-xl text-sm font-medium text-muted hover:bg-surface-2 transition"
      >
        <Plus size={14} />
        Add Address
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
              <h3 className="text-lg font-bold text-text">Add New Address</h3>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center hover:bg-surface-3 transition"
              >
                <X size={15} className="text-muted" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {FIELDS.map(({ key, label, placeholder }) => (
                <div key={key} className={key === "address" ? "col-span-2" : ""}>
                  <label className="text-xs font-semibold text-muted mb-1.5 block">{label}</label>
                  <input
                    placeholder={placeholder}
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-faint focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
                    value={(form as any)[key]}
                    onChange={(e) => handleChange(key as any, e.target.value)}
                  />
                  {errors[key] && <p className="text-red-500 dark:text-red-400 text-xs mt-1">{errors[key]}</p>}
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
              {loading ? "Saving..." : "Save Address"}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
