"use client"

import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { loginSchema } from "@repo/crm-schema"
import ThemeToggle from "@/components/shell/ThemeToggle"
import Button from "@/components/ui/Button"
import { Field, FormError, Input } from "@/components/ui/Form"
import { signIn } from "@/features/auth/api"
import { useApiForm } from "@/lib/use-api-form"

/** Only same-app relative paths are honoured, so `next` can't redirect off-site. */
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/"
}

function LoginForm() {
  const router = useRouter()
  const next = safeNext(useSearchParams().get("next"))
  const { form, formError, submitWith } = useApiForm(loginSchema, { email: "", password: "" })
  const { register, formState } = form

  const onSubmit = submitWith(async (values) => {
    const user = await signIn(values)
    router.replace(user.mustChangePassword ? "/change-password" : next)
  })

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormError message={formError} />
      <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
        <Input id="email" type="email" autoComplete="username" autoFocus aria-invalid={!!formState.errors.email} {...register("email")} />
      </Field>
      <Field label="Password" htmlFor="password" error={formState.errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!formState.errors.password}
          {...register("password")}
        />
      </Field>
      <Button type="submit" className="w-full" loading={formState.isSubmitting}>
        Sign in
      </Button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-dvh bg-surface-2 flex items-center justify-center p-4 relative">
      <ThemeToggle className="absolute top-4 right-4" />
      <div className="w-full max-w-sm bg-surface border border-border rounded-2xl shadow-card p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
            <span className="text-white text-xs font-bold">LS</span>
          </div>
          <div>
            <p className="font-bold text-text text-sm leading-tight">Little Stepz</p>
            <p className="text-[11px] text-faint">Business CRM · private access</p>
          </div>
        </div>
        <h1 className="text-xl font-semibold text-text mb-1">Sign in</h1>
        <p className="text-sm text-muted mb-6">Use the account your administrator created for you.</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
