"use client"

import { useState } from "react"
import { UserService } from "../../lib/services/user.service"
import { updateProfileSchema } from "@repo/zod-schema/index"
import { toast } from "sonner"
import { X } from "lucide-react"

export default function EditProfileDialog({ user, onUpdated }: any) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    name: user.name || "",
    phone: user.phone || "",
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (key: keyof typeof form, value: string) => {
    setForm((p) => ({ ...p, [key]: value }))
    setErrors((p) => ({ ...p, [key]: "" }))
  }

  const handleSave = async () => {
    const parsed = updateProfileSchema.safeParse(form)

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
      const updated = await UserService.updateMe(parsed.data)
      onUpdated(updated)
      toast.success("Profile updated")
      setOpen(false)
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
        className="px-4 py-2 border rounded-lg text-sm"
      >
        Edit Details
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white p-6 rounded-xl w-full max-w-md space-y-4 relative"
          >
            <X className="absolute right-4 top-4 cursor-pointer" onClick={() => setOpen(false)} />

            <h3 className="font-semibold text-lg">Edit Profile</h3>

            <div>
              <input
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Name"
                className="input"
              />
              {errors.name && <p className="text-red-500 text-xs">{errors.name}</p>}
            </div>

            <div>
              <input
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="Phone"
                className="input"
              />
              {errors.phone && <p className="text-red-500 text-xs">{errors.phone}</p>}
            </div>

            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full bg-primary text-white py-2 rounded-lg"
            >
              {loading ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
