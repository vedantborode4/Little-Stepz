"use client"

import { useState } from "react"
import { UserService } from "../../lib/services/user.service"
import { updatePasswordSchema } from "@repo/zod-schema/index"
import { toast } from "sonner"
import { X } from "lucide-react"

export default function ChangePasswordDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    oldPassword: "",
    newPassword: "",
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (key: keyof typeof form, value: string) => {
    setForm((p) => ({ ...p, [key]: value }))
    setErrors((p) => ({ ...p, [key]: "" }))
  }

  const handleSubmit = async () => {
    const parsed = updatePasswordSchema.safeParse(form)

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
      await UserService.changePassword(parsed.data)
      toast.success("Password changed")
      setOpen(false)
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
        className="bg-primary text-white px-4 py-2 rounded-lg text-sm"
      >
        Change Password
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

            <h3 className="font-semibold text-lg">Change Password</h3>

            <input
              type="password"
              placeholder="Old password"
              className="input"
              onChange={(e) => handleChange("oldPassword", e.target.value)}
            />
            {errors.oldPassword && <p className="text-red-500 text-xs">{errors.oldPassword}</p>}

            <input
              type="password"
              placeholder="New password"
              className="input"
              onChange={(e) => handleChange("newPassword", e.target.value)}
            />
            {errors.newPassword && <p className="text-red-500 text-xs">{errors.newPassword}</p>}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-primary text-white py-2 rounded-lg"
            >
              {loading ? "Updating…" : "Update Password"}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
