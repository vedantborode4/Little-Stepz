"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { SignupSchema } from "@repo/zod-schema/index"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useAuth } from "../../../hooks/use-auth"
import { AuthService } from "../../../lib/services/auth.service"
import { AuthCard, Button, Input } from "@repo/ui/index"


export default function SignUpPage() {
  const router = useRouter()
  const { login } = useAuth()

  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(SignupSchema),
  })

  const onSubmit = async (data: any) => {
    try {
      const res = await AuthService.signUp(data)
      login(res)
      router.push("/")
    } catch {
      toast.error("Signup failed")
    }
  }

  return (
    <AuthCard>
      <div className="space-y-2 text-center">
        <h2>Create Account ✨</h2>
        <p className="text-muted">Start your Little Stepz journey</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input placeholder="Full Name" {...register("name")} />
        <Input placeholder="Email" {...register("email")} />
        <Input type="password" placeholder="Password" {...register("password")} />

        <Button loading={formState.isSubmitting}>
          Sign Up
        </Button>
      </form>
    </AuthCard>
  )
}
