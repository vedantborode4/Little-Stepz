"use client"

import { useEffect, useState } from "react"
import { CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { PhoneService } from "../../lib/services/phone.service"
import { friendlyError } from "../../lib/errorMessages"

interface Props {
  value: string
  onChange: (v: string) => void
  /** True when this number is already proven for this user. */
  verified: boolean
  onVerified: () => void
  error?: string
  /** Editing an address whose phone hasn't changed needs no OTP. */
  required?: boolean
}

const PHONE_RE = /^[6-9]\d{9}$/

/**
 * Phone input with inline OTP verification.
 *
 * Verifies `Address.phone` — the number the courier actually calls — rather than
 * the account's phone, which never reaches Delhivery.
 */
export default function PhoneVerifyField({
  value,
  onChange,
  verified,
  onVerified,
  error,
  required = true,
}: Props) {
  const [sending, setSending] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [code, setCode] = useState("")
  const [verifying, setVerifying] = useState(false)
  const [otpError, setOtpError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(id)
  }, [cooldown])

  // Changing the number invalidates anything already in flight.
  useEffect(() => {
    setCodeSent(false)
    setCode("")
    setOtpError(null)
  }, [value])

  const send = async () => {
    if (!PHONE_RE.test(value)) {
      setOtpError("Enter a valid 10-digit mobile number")
      return
    }
    setSending(true)
    setOtpError(null)
    try {
      const res = await PhoneService.sendOtp(value)
      if (res.alreadyVerified) {
        onVerified()
        toast.success("This number is already verified")
        return
      }
      setCodeSent(true)
      setCooldown(res.resendAfterSeconds ?? 60)
      toast.success("Verification code sent")
    } catch (e) {
      setOtpError(friendlyError(e, "Couldn't send the code"))
    } finally {
      setSending(false)
    }
  }

  const verify = async () => {
    if (code.length !== 6) {
      setOtpError("Enter the 6-digit code")
      return
    }
    setVerifying(true)
    setOtpError(null)
    try {
      await PhoneService.verifyOtp(value, code)
      setCodeSent(false)
      setCode("")
      onVerified()
      toast.success("Phone number verified")
    } catch (e) {
      setOtpError(friendlyError(e, "That code isn't right"))
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder="Phone"
          inputMode="numeric"
          className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-surface text-text text-sm"
        />
        {verified ? (
          <span className="flex items-center gap-1.5 px-3 text-sm font-medium text-green-600 dark:text-green-400">
            <CheckCircle2 size={16} /> Verified
          </span>
        ) : (
          required && (
            <button
              type="button"
              onClick={send}
              disabled={sending || cooldown > 0}
              className="px-4 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-60"
            >
              {sending ? "Sending…" : cooldown > 0 ? `${cooldown}s` : codeSent ? "Resend" : "Verify"}
            </button>
          )
        )}
      </div>

      {codeSent && !verified && (
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              setOtpError(null)
            }}
            placeholder="6-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-surface text-text text-sm"
          />
          <button
            type="button"
            onClick={verify}
            disabled={verifying}
            className="px-4 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-60"
          >
            {verifying ? "Checking…" : "Confirm"}
          </button>
        </div>
      )}

      {(otpError || error) && (
        <p className="text-sm text-red-500 dark:text-red-400">{otpError ?? error}</p>
      )}
      {!verified && required && !codeSent && !otpError && (
        <p className="text-xs text-muted">
          We&apos;ll text a code to confirm this is the number our courier can reach.
        </p>
      )}
    </div>
  )
}
