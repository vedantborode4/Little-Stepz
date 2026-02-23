"use client"

import GuestGuard from "../../../components/guard/GuestGuard"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { SigninData, SigninSchema } from "@repo/zod-schema/index"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { AuthService } from "../../../lib/services/auth.service"
import { useAuth } from "../../../hooks/use-auth"
import { Button, Input, AuthCard } from "@repo/ui/index"

export default function SignInPage() {
  const router = useRouter()
  const { login } = useAuth()

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<SigninData>({
    resolver: zodResolver(SigninSchema),
    mode: "onChange",
  })

  const onSubmit = async (data: SigninData) => {
    try {
      const res = await AuthService.signIn(data)
      login(res)
      router.push("/")
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        "Invalid email or password"

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
          <h2>Welcome Back 👋</h2>
          <p className="text-muted">Login to continue shopping</p>
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
              <p className="text-sm text-red-500">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Input
              type="password"
              placeholder="Password"
              {...register("password", {
                onChange: () => clearErrors("password"),
              })}
            />
            {errors.password && (
              <p className="text-sm text-red-500">
                {errors.password.message}
              </p>
            )}
          </div>

          <Button loading={isSubmitting}>Sign In</Button>
        </form>

        <p className="text-center text-sm text-muted">
          Don’t have an account?{" "}
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