"use client"

import GuestGuard from "../../../components/guard/GuestGuard"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { SignupSchema, type SignupData } from "@repo/zod-schema/index"
import VerifyEmailStep from "./VerifyEmailStep"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useAuth } from "../../../hooks/use-auth"
import { AuthService } from "../../../lib/services/auth.service"
import { AuthCard, Button, Input } from "@repo/ui/index"
import PasswordInput from "../../../components/common/PasswordInput"
import GoogleAuthButton from "../../../components/auth/GoogleAuthButton"
import { friendlyError } from "../../../lib/errorMessages"
import { safeRedirectTarget } from "../../../lib/utils/redirect"

const SignupFormSchema = SignupSchema.extend({
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})

type SignupFormData = z.infer<typeof SignupFormSchema>

interface PendingSignup {
  payload: SignupData
  expiresInMinutes: number
  resendAfterSeconds: number
}

export default function SignUpPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [pending, setPending] = useState<PendingSignup | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormData>({
    resolver: zodResolver(SignupFormSchema),
    mode: "onChange",
  })

  const onSubmit = async (data: SignupFormData) => {
    try {
      const { confirmPassword: _confirmPassword, ...signupData } = data
      // No account is created here — this only emails a code. The payload stays in
      // component state (never localStorage: it contains a plaintext password), so a
      // reload correctly drops back to step 1 rather than stranding a half-signup.
      const meta = await AuthService.requestSignupOtp(signupData)
      setPending({ payload: signupData, ...meta })
    } catch (error: any) {
      const message = friendlyError(error, "Signup failed")

      // The backend now returns a code, not prose — the old substring sniff for
      // "user already exists" would never match again.
      if (error?.response?.data?.message === "EMAIL_ALREADY_REGISTERED") {
        setError("email", { type: "server", message })
        return
      }

      toast.error(message)
    }
  }

  if (pending) {
    return (
      <GuestGuard>
        <AuthCard>
          <VerifyEmailStep
            payload={pending.payload}
            expiresInMinutes={pending.expiresInMinutes}
            resendAfterSeconds={pending.resendAfterSeconds}
            onVerified={async (res) => {
              await login(res)
              router.push("/")
            }}
            onBack={() => setPending(null)}
          />
        </AuthCard>
      </GuestGuard>
    )
  }

  return (
    <GuestGuard>
      <AuthCard>
        <div className="space-y-2 text-center">
          <h2>Create Account </h2>
          <p className="text-muted">Start your Little Stepz journey</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Input
              placeholder="Full Name"
              {...register("name", {
                onChange: () => clearErrors("name"),
              })}
            />
            {errors.name && (
              <p className="text-sm text-red-500 dark:text-red-400">
                {errors.name.message}
              </p>
            )}
          </div>

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

          <div className="space-y-1">
            <PasswordInput
              placeholder="Password"
              {...register("password", {
                onChange: () => clearErrors("password"),
              })}
            />
            {errors.password ? (
              <p className="text-sm text-red-500 dark:text-red-400">
                {errors.password.message}
              </p>
            ) : (
              <p className="text-xs text-muted">
                At least 8 characters, with an uppercase letter, a lowercase
                letter, and a number.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <PasswordInput
              placeholder="Confirm Password"
              {...register("confirmPassword", {
                onChange: () => clearErrors("confirmPassword"),
              })}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-red-500 dark:text-red-400">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button loading={isSubmitting}>Sign Up</Button>
        </form>

        <GoogleAuthButton redirectTo={safeRedirectTarget()} />

        <p className="text-center text-sm text-muted">
          Already have an account?{" "}
          <span
            onClick={() => router.push("/signin")}
            className="text-primary font-semibold cursor-pointer"
          >
            Sign in
          </span>
        </p>
      </AuthCard>
    </GuestGuard>
  )
}