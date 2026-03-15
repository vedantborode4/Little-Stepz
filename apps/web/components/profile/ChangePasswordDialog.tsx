"use client"

import { useState } from "react"
import { UserService } from "../../lib/services/user.service"
import { updatePasswordSchema } from "@repo/zod-schema/index"
import { toast } from "sonner"
import { X, Lock, Loader2, Eye, EyeOff } from "lucide-react"

// Inline password field — keeps focus stable, no remount on re-render
function PasswordField({
  label,
  placeholder,
  value,
  onChange,
  error,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  error?: string
}) {
  const [show, setShow] = useState(false)

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm pr-10 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((p) => !p)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}

export default function ChangePasswordDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (key: keyof typeof form, value: string) => {
    setForm((p) => ({ ...p, [key]: value }))
    setErrors((p) => ({ ...p, [key]: "" }))
  }

  const handleClose = () => {
    setOpen(false)
    setForm({ oldPassword: "", newPassword: "", confirmPassword: "" })
    setErrors({})
  }

  const handleSubmit = async () => {
    const e: Record<string, string> = {}

    // Frontend confirm check — before hitting the schema
    if (!form.oldPassword) e.oldPassword = "Current password is required"
    if (!form.newPassword) e.newPassword = "New password is required"
    if (!form.confirmPassword) {
      e.confirmPassword = "Please confirm your new password"
    } else if (form.newPassword !== form.confirmPassword) {
      e.confirmPassword = "Passwords don't match"
    }

    if (Object.keys(e).length) {
      setErrors(e)
      return
    }

    // Schema validation on the fields the API actually needs
    const parsed = updatePasswordSchema.safeParse({
      oldPassword: form.oldPassword,
      newPassword: form.newPassword,
    })
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
      await UserService.changePassword(parsed.data)
      toast.success("Password changed successfully")
      handleClose()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to change password")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 bg-primary text-white px-3.5 py-2 rounded-xl text-sm font-semibold hover:opacity-90 transition shadow-sm"
      >
        <Lock size={13} />
        Change Password
      </button>

      {open && (
        <div
          onClick={handleClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Change Password</h3>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-xl hover:bg-gray-100 transition text-gray-400"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <PasswordField
                label="Current Password"
                placeholder="Enter current password"
                value={form.oldPassword}
                onChange={(v) => handleChange("oldPassword", v)}
                error={errors.oldPassword}
              />

              <PasswordField
                label="New Password"
                placeholder="Enter new password"
                value={form.newPassword}
                onChange={(v) => handleChange("newPassword", v)}
                error={errors.newPassword}
              />

              <PasswordField
                label="Confirm New Password"
                placeholder="Re-enter new password"
                value={form.confirmPassword}
                onChange={(v) => handleChange("confirmPassword", v)}
                error={errors.confirmPassword}
              />

              {/* Live match indicator — only shown once both fields have content */}
              {form.newPassword && form.confirmPassword && (
                <p className={`text-xs font-medium flex items-center gap-1.5 ${
                  form.newPassword === form.confirmPassword
                    ? "text-green-600"
                    : "text-red-500"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    form.newPassword === form.confirmPassword
                      ? "bg-green-500"
                      : "bg-red-500"
                  }`} />
                  {form.newPassword === form.confirmPassword
                    ? "Passwords match"
                    : "Passwords don't match"}
                </p>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm mt-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Updating…" : "Update Password"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}