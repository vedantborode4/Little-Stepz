"use client"

import { useState } from "react"
import { UserService } from "../../lib/services/user.service"
import { updateProfileSchema } from "@repo/zod-schema/index"
import { toast } from "sonner"
import { X, Pencil, Loader2 } from "lucide-react"

export default function EditProfileDialog({ user, onUpdated }: any) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({ name: user.name || "", phone: user.phone || "" })
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
        if (typeof key === "string") fieldErrors[key] = i.message
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
        className="flex items-center bg-white gap-1.5 border border-gray-200 text-gray-700 px-3.5 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
      >
        <Pencil size={13} />
        Edit
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Edit Profile</h3>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-xl hover:bg-gray-100 transition text-gray-400"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Your name"
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-primary transition"
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Phone</label>
                <input
                  value={form.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  placeholder="Phone number"
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-primary transition"
                />
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
              </div>

              <button
                onClick={handleSave}
                disabled={loading}
                className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm mt-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
