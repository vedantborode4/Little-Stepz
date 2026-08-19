"use client"

import { useEffect, useState } from "react"
import { MailCheck } from "lucide-react"
import { Button, Input } from "@repo/ui/index"
import { toast } from "sonner"
import { AuthService } from "../../../lib/services/auth.service"
import { friendlyError } from "../../../lib/errorMessages"
import type { SignupData } from "@repo/zod-schema/index"
import type { AuthResponse } from "../../../types/auth"

interface Props {
  /** Held in memory only — never persisted, so a reload correctly restarts signup. */
  payload: SignupData
  expiresInMinutes: number
  resendAfterSeconds: number
  onVerified: (res: AuthResponse) => Promise<void> | void
  onBack: () => void
}

export default function VerifyEmailStep({
  payload,
  expiresInMinutes,
  resendAfterSeconds,
  onVerified,
  onBack,
}: Props) {
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(resendAfterSeconds)

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(id)
  }, [cooldown])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length !== 6) {
      setError("Enter the 6-digit code from your email")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await AuthService.verifySignupOtp({ email: payload.email, code })
      await onVerified(res)
    } catch (err: any) {
      // A wrong code is a field problem, not a toast — it belongs next to the input.
      setError(friendlyError(err, "This code is invalid or has expired"))
    } finally {
      setSubmitting(false)
    }
  }

  const resend = async () => {
    if (cooldown > 0 || resending) return
    setResending(true)
    try {
      // Re-POSTing step 1 IS the resend: it supersedes the outstanding code, so there
      // is no second live code and one place enforces the cooldown.
      const meta = await AuthService.requestSignupOtp(payload)
      setCooldown(meta.resendAfterSeconds)
      setCode("")
      setError(null)
      toast.success("New code sent")
    } catch (err: any) {
      toast.error(friendlyError(err, "Couldn't resend the code"))
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2 text-center">
        <MailCheck className="mx-auto text-primary" size={32} />
        <h2>Confirm your email</h2>
        <p className="text-muted text-sm">
          We sent a 6-digit code to <strong className="text-text">{payload.email}</strong>.
          It expires in {expiresInMinutes} minutes.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1">
          <Input
            placeholder="123456"
            value={code}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setCode(e.target.value.replace(/\D/g, ""))
              setError(null)
            }}
          />
          {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
        </div>

        <Button loading={submitting}>Verify email</Button>
      </form>

      <p className="text-center text-sm text-muted">
        Didn&apos;t get it?{" "}
        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0 || resending}
          className="text-primary font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? "Sending…" : "Resend code"}
        </button>
      </p>

      <p className="text-center text-sm">
        <button type="button" onClick={onBack} className="text-muted hover:text-text">
          ← Use a different email
        </button>
      </p>
    </div>
  )
}
