"use client"

import { useState } from "react"
import { AddressService } from "../../lib/services/address.service"
import { createAddressSchema } from "@repo/zod-schema/index"
import { toast } from "sonner"
import { X } from "lucide-react"

export default function AddressFormDialog({ onCreated }: any) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
    isDefault: false,
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
        if (typeof key === "string") {
          fieldErrors[key] = i.message
        }
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
        className="px-4 py-2 border rounded-lg text-sm"
      >
        Add New Address
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl p-6 w-full max-w-lg space-y-4 relative"
          >
            <X className="absolute right-4 top-4 cursor-pointer" onClick={() => setOpen(false)} />

            <h3 className="text-lg font-semibold">Add Address</h3>

            {Object.entries(form).map(([key, value]) =>
              key !== "isDefault" ? (
                <div key={key}>
                  <input
                    placeholder={key}
                    className="input"
                    value={value as string}
                    onChange={(e) => handleChange(key as keyof typeof form, e.target.value)}
                  />
                  {errors[key] && (
                    <p className="text-red-500 text-xs">{errors[key]}</p>
                  )}
                </div>
              ) : null
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-primary text-white py-2 rounded-lg"
            >
              {loading ? "Saving…" : "Save Address"}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
