"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { SigninSchema } from "@repo/zod-schema/index"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { AuthService } from "../../../lib/services/auth.service"
import { useAuth } from "../../../hooks/use-auth"
import { Button, Input, AuthCard } from "@repo/ui/index"

export default function SignInPage() {
  const router = useRouter()
  const { login } = useAuth()

  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(SigninSchema),
  })

  const onSubmit = async (data: any) => {
    try {
      const res = await AuthService.signIn(data)
      login(res)
      router.push("/")
    } catch {
      toast.error("Invalid email or password")
    }
  }

  return (
    <AuthCard>
      <div className="space-y-2 text-center">
        <h2>Welcome Back 👋</h2>
        <p className="text-muted">Login to continue shopping</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input placeholder="Email" {...register("email")} />
        <Input type="password" placeholder="Password" {...register("password")} />

        <Button loading={formState.isSubmitting}>
          Sign In
        </Button>
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
  )
}
