"use client"

import { useState } from "react"
import { updateAddressSchema } from "@repo/zod-schema/index"
import { AddressService } from "../../lib/services/address.service"
import { toast } from "sonner"
import { X } from "lucide-react"

export default function EditAddressDialog({ address, onUpdated }: any) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({ ...address })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (key: string, value: string | boolean) => {
    setForm((p: any) => ({ ...p, [key]: value }))
    setErrors((p) => ({ ...p, [key]: "" }))
  }

  const handleSubmit = async () => {
    const parsed = updateAddressSchema.safeParse(form)

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

      await AddressService.update(address.id, parsed.data)

      toast.success("Address updated")
      setOpen(false)
      onUpdated()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Update failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-primary"
      >
        Edit
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
            <X
              className="absolute right-4 top-4 cursor-pointer"
              onClick={() => setOpen(false)}
            />

            <h3 className="text-lg font-semibold">Edit Address</h3>

            {[
              "name",
              "phone",
              "address",
              "city",
              "state",
              "pincode",
              "country",
            ].map((field) => (
              <div key={field}>
                <input
                  className="input"
                  value={form[field] || ""}
                  placeholder={field}
                  onChange={(e) =>
                    handleChange(field, e.target.value)
                  }
                />
                {errors[field] && (
                  <p className="text-red-500 text-xs">
                    {errors[field]}
                  </p>
                )}
              </div>
            ))}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) =>
                  handleChange("isDefault", e.target.checked)
                }
              />
              Set as default
            </label>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-primary text-white py-2 rounded-lg"
            >
              {loading ? "Updating…" : "Update Address"}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
