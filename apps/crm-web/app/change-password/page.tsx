"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { changePasswordSchema, PASSWORD_MIN_LENGTH } from "@repo/crm-schema"
import Button from "@/components/ui/Button"
import { Field, FormError, Input } from "@/components/ui/Form"
import AuthGate from "@/features/auth/AuthGate"
import { changePassword, signOut } from "@/features/auth/api"
import { useApiForm } from "@/lib/use-api-form"
import { useAuthStore } from "@/store/auth.store"

function ChangePasswordForm() {
  const router = useRouter()
  const forced = useAuthStore((s) => s.user?.mustChangePassword)
  const { form, formError, submitWith } = useApiForm(changePasswordSchema, { currentPassword: "", newPassword: "" })
  const { register, formState } = form

  const onSubmit = submitWith(async (values) => {
    await changePassword(values)
    toast.success("Password updated")
    router.replace("/")
  })

  return (
    <div className="min-h-dvh bg-surface-2 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-surface border border-border rounded-2xl shadow-card p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-text mb-1">{forced ? "Set your password" : "Change password"}</h1>
        <p className="text-sm text-muted mb-6">
          {forced
            ? "Your account uses a temporary password. Choose your own to continue."
            : "Other devices signed in to your account will be signed out."}
        </p>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormError message={formError} />
          <Field label={forced ? "Temporary password" : "Current password"} htmlFor="currentPassword" error={formState.errors.currentPassword?.message}>
            <Input id="currentPassword" type="password" autoComplete="current-password" {...register("currentPassword")} />
          </Field>
          <Field
            label="New password"
            htmlFor="newPassword"
            error={formState.errors.newPassword?.message}
            hint={`At least ${PASSWORD_MIN_LENGTH} characters, with a letter and a number.`}
          >
            <Input id="newPassword" type="password" autoComplete="new-password" {...register("newPassword")} />
          </Field>
          <Button type="submit" className="w-full" loading={formState.isSubmitting}>
            Save password
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => (forced ? signOut() : router.back())}>
            {forced ? "Sign out" : "Cancel"}
          </Button>
        </form>
      </div>
    </div>
  )
}

export default function ChangePasswordPage() {
  return (
    <AuthGate>
      <ChangePasswordForm />
    </AuthGate>
  )
}
