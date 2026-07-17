"use client"

import GuestGuard from "../../../components/guard/GuestGuard"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { SignupSchema } from "@repo/zod-schema/index"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useAuth } from "../../../hooks/use-auth"
import { AuthService } from "../../../lib/services/auth.service"
import { AuthCard, Button, Input } from "@repo/ui/index"
import PasswordInput from "../../../components/common/PasswordInput"
import GoogleAuthButton from "../../../components/auth/GoogleAuthButton"
import { friendlyError } from "../../../lib/errorMessages"

const SignupFormSchema = SignupSchema.extend({
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})

type SignupFormData = z.infer<typeof SignupFormSchema>

export default function SignUpPage() {
  const router = useRouter()
  const { login } = useAuth()

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
      const res = await AuthService.signUp(signupData)
      await login(res)
      router.push("/")
    } catch (error: any) {
      const message = friendlyError(error, "Signup failed")

      if (message.toLowerCase().includes("user already exists")) {
        setError("email", {
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

        <GoogleAuthButton redirectTo="/" />

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