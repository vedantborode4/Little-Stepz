"use client"

import GuestGuard from "../../../components/guard/GuestGuard"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { SigninData, SigninSchema } from "@repo/zod-schema/index"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { AuthService } from "../../../lib/services/auth.service"
import { useAuth } from "../../../hooks/use-auth"
import { Button, Input, AuthCard } from "@repo/ui/index"
import PasswordInput from "../../../components/common/PasswordInput"
import GoogleAuthButton from "../../../components/auth/GoogleAuthButton"
import { friendlyError } from "../../../lib/errorMessages"
import { safeRedirectTarget } from "../../../lib/utils/redirect"

export default function SignInPage() {
  const router = useRouter()
  const { login } = useAuth()

  // Set when the account exists but was created through Google/Apple, so there is no
  // password to check. Rendered as a notice with a route forward rather than a field
  // error, because no amount of retyping the password can fix it.
  const [oauthOnly, setOauthOnly] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<SigninData>({
    resolver: zodResolver(SigninSchema),
    mode: "onChange",
  })

  /** Same-site paths only — see lib/utils/redirect.ts for the open-redirect guard. */
  const safeRedirect = safeRedirectTarget

  const onSubmit = async (data: SigninData) => {
    setOauthOnly(null)
    try {
      const res = await AuthService.signIn(data)
      await login(res)
      router.push(safeRedirect())
    } catch (error: any) {
      const message = friendlyError(error, "Invalid email or password")

      if (error?.response?.data?.code === "PASSWORD_NOT_SET") {
        setOauthOnly(message)
        return
      }

      if (message.toLowerCase().includes("invalid")) {
        setError("password", {
          type: "server",
          message,
        })
        return
      }

      toast.error(message)
    }
  }

  return (
    <GuestGuard>
      <AuthCard>
        <div className="space-y-2 text-center">
          <h2>Welcome Back </h2>
          <p className="text-muted">Login to continue shopping</p>
        </div>

        {oauthOnly && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2">
            <p className="text-sm text-text">{oauthOnly}</p>
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/forgot-password?email=${encodeURIComponent(getValues("email") ?? "")}`
                )
              }
              className="text-sm font-semibold text-primary hover:underline"
            >
              Set a password →
            </button>
          </div>
        )}

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

          <div className="space-y-1">
            <PasswordInput
              placeholder="Password"
              {...register("password", {
                onChange: () => clearErrors("password"),
              })}
            />
            {errors.password && (
              <p className="text-sm text-red-500 dark:text-red-400">
                {errors.password.message}
              </p>
            )}
            <div className="text-right">
              <span
                onClick={() => router.push("/forgot-password")}
                className="text-sm text-primary font-semibold cursor-pointer"
              >
                Forgot password?
              </span>
            </div>
          </div>

          <Button loading={isSubmitting}>Sign In</Button>
        </form>

        <GoogleAuthButton redirectTo={safeRedirect()} />

        <p className="text-center text-sm text-muted">
          Don't have an account?{" "}
          <span
            onClick={() => router.push("/signup")}
            className="text-primary font-semibold cursor-pointer"
          >
            Sign up
          </span>
        </p>
      </AuthCard>
    </GuestGuard>
  )
}