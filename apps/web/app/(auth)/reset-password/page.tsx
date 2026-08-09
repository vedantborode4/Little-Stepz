"use client"

import { useEffect, useState } from "react"
import GuestGuard from "../../../components/guard/GuestGuard"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { resetPasswordSchema } from "@repo/zod-schema/index"
import { z } from "zod"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Check, TriangleAlert } from "lucide-react"
import { AuthService } from "../../../lib/services/auth.service"
import { Button, AuthCard } from "@repo/ui/index"
import PasswordInput from "../../../components/common/PasswordInput"
import { friendlyError } from "../../../lib/errorMessages"

const formSchema = resetPasswordSchema
  .omit({ token: true })
  .extend({ confirmPassword: z.string().min(1, "Please confirm your password") })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

type FormData = z.infer<typeof formSchema>

export default function ResetPasswordPage() {
  const router = useRouter()
  // undefined = not read yet, null = missing from the URL
  const [token, setToken] = useState<string | null | undefined>(undefined)
  const [expired, setExpired] = useState(false)

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
  })

  // read the token from the emailed link (avoids the useSearchParams Suspense boundary)
  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token"))
  }, [])

  const newPassword = watch("newPassword")
  const confirmPassword = watch("confirmPassword")
  const matches = !!newPassword && newPassword === confirmPassword

  const onSubmit = async (data: FormData) => {
    if (!token) return
    try {
      await AuthService.resetPassword({ token, newPassword: data.newPassword })
      toast.success("Password reset. Sign in with your new password.")
      router.push("/signin")
    } catch (error: any) {
      const message = friendlyError(error, "Could not reset your password. Try again.")

      if (/invalid|expired/i.test(message)) {
        setExpired(true)
        return
      }

      setError("newPassword", { type: "server", message })
    }
  }

  const linkBroken = expired || token === null

  return (
    <GuestGuard>
      <AuthCard>
        {linkBroken ? (
          <>
            <div className="space-y-3 text-center">
              <TriangleAlert className="mx-auto text-red-500" size={40} />
              <h2>Link expired</h2>
              <p className="text-muted text-sm">
                This reset link is invalid or has already been used. Request a new one to
                continue.
              </p>
            </div>

            <Button onClick={() => router.push("/forgot-password")}>
              Request a new link
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-2 text-center">
              <h2>Set a new password</h2>
              <p className="text-muted">
                Choose a password you haven&apos;t used before.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1">
                <PasswordInput
                  placeholder="New password"
                  {...register("newPassword", {
                    onChange: () => clearErrors("newPassword"),
                  })}
                />
                {errors.newPassword && (
                  <p className="text-sm text-red-500 dark:text-red-400">
                    {errors.newPassword.message}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <PasswordInput
                  placeholder="Confirm new password"
                  {...register("confirmPassword", {
                    onChange: () => clearErrors("confirmPassword"),
                  })}
                />
                {errors.confirmPassword ? (
                  <p className="text-sm text-red-500 dark:text-red-400">
                    {errors.confirmPassword.message}
                  </p>
                ) : matches ? (
                  <p className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                    <Check size={14} /> Passwords match
                  </p>
                ) : null}
              </div>

              {/* Button spreads props after its own disabled={loading}, so the
                  submitting guard has to be repeated here or it gets overridden. */}
              <Button loading={isSubmitting} disabled={!token || isSubmitting}>
                Reset password
              </Button>
            </form>

            <p className="text-center text-sm text-muted">
              Back to{" "}
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
