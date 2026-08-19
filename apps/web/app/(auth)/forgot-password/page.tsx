"use client"

import { useEffect, useState } from "react"
import GuestGuard from "../../../components/guard/GuestGuard"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ForgotPasswordData, forgotPasswordSchema } from "@repo/zod-schema/index"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { MailCheck } from "lucide-react"
import { AuthService } from "../../../lib/services/auth.service"
import { Button, Input, AuthCard } from "@repo/ui/index"
import { friendlyError } from "../../../lib/errorMessages"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [sentTo, setSentTo] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    clearErrors,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordData>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onChange",
  })

  // Sign-in sends OAuth-only accounts here to set their first password; carrying the
  // address over saves retyping it. Read off window rather than useSearchParams, for
  // the same reason as reset-password — it avoids needing a Suspense boundary.
  useEffect(() => {
    const email = new URLSearchParams(window.location.search).get("email")
    if (email) setValue("email", email)
  }, [setValue])

  const onSubmit = async (data: ForgotPasswordData) => {
    try {
      await AuthService.forgotPassword(data)
      setSentTo(data.email)
    } catch (error: any) {
      toast.error(friendlyError(error, "Could not send the reset email. Try again."))
    }
  }

  const resend = async () => {
    try {
      await AuthService.forgotPassword({ email: getValues("email") })
      toast.success("Reset email sent again")
    } catch (error: any) {
      toast.error(friendlyError(error, "Could not resend the email. Try again."))
    }
  }

  return (
    <GuestGuard>
      <AuthCard>
        {sentTo ? (
          <>
            <div className="space-y-3 text-center">
              <MailCheck className="mx-auto text-primary" size={40} />
              <h2>Check your email</h2>
              <p className="text-muted text-sm">
                If an account exists for <strong>{sentTo}</strong>, we&apos;ve sent a reset
                link and a 6-digit code. The link expires in 15 minutes.
              </p>
            </div>

            <Button onClick={() => router.push("/signin")}>Back to sign in</Button>

            <p className="text-center text-sm text-muted">
              Didn&apos;t get it?{" "}
              <span onClick={resend} className="text-primary font-semibold cursor-pointer">
                Resend email
              </span>
            </p>
          </>
        ) : (
          <>
            <div className="space-y-2 text-center">
              <h2>Forgot password?</h2>
              <p className="text-muted">
                Enter your email and we&apos;ll send you a link to reset it.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1">
                <Input
                  placeholder="Email"
                  {...register("email", {
                    onChange: () => clearErrors("email"),
                  })}
                />
                {errors.email && (
                  <p className="text-sm text-red-500 dark:text-red-400">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <Button loading={isSubmitting}>Send reset link</Button>
            </form>

            <p className="text-center text-sm text-muted">
              Remembered it?{" "}
              <span
                onClick={() => router.push("/signin")}
                className="text-primary font-semibold cursor-pointer"
              >
                Sign in
              </span>
            </p>
          </>
        )}
      </AuthCard>
    </GuestGuard>
  )
}
