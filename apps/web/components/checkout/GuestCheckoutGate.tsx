"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { LogIn, UserRound, Loader2 } from "lucide-react"
import { guestCheckoutStartSchema } from "@repo/zod-schema/index"
import { GuestCheckoutService } from "../../lib/services/guest-checkout.service"
import { friendlyError } from "../../lib/errorMessages"
import { useGuestSessionStore } from "../../store/useGuestSessionStore"

const inputClass = "w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-text text-sm"
const SIGN_IN_HREF = `/signin?redirect=${encodeURIComponent("/checkout")}`

const errorCode = (err: unknown): string | undefined =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message

/**
 * Checkout for a shopper who isn't signed in: sign in, or continue as a guest with name,
 * email and phone, confirmed by an SMS code. The code proves the number the courier will
 * call; the guest session it unlocks lasts for this checkout only.
 */
export default function GuestCheckoutGate() {
  const startSession = useGuestSessionStore((s) => s.start)

  const [form, setForm] = useState({ name: "", email: "", phone: "" })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [code, setCode] = useState("")
  const [codeSent, setCodeSent] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accountExists, setAccountExists] = useState(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const update = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    setFieldErrors((e) => ({ ...e, [key]: "" }))
    setError(null)
    setAccountExists(false)
    // Changing the email or phone after a code went out means starting again.
    if (key !== "name") {
      setCodeSent(false)
      setCode("")
    }
  }

  const sendCode = async () => {
    const parsed = guestCheckoutStartSchema.safeParse(form)
    if (!parsed.success) {
      const next: Record<string, string> = {}
      parsed.error.issues.forEach((i) => {
        const key = i.path[0]
        if (typeof key === "string" && !next[key]) next[key] = i.message
      })
      setFieldErrors(next)
      return
    }
    try {
      setBusy(true)
      setError(null)
      const res = await GuestCheckoutService.start(parsed.data)
      setCodeSent(true)
      setCooldown(res.resendAfterSeconds ?? 30)
    } catch (err) {
      if (errorCode(err) === "ACCOUNT_EXISTS") setAccountExists(true)
      else setError(friendlyError(err, "We couldn't send the code. Please try again."))
    } finally {
      setBusy(false)
    }
  }

  const verify = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code we sent you")
      return
    }
    try {
      setBusy(true)
      setError(null)
      const parsed = guestCheckoutStartSchema.parse(form)
      const res = await GuestCheckoutService.verify({ email: parsed.email, phone: parsed.phone, code })
      startSession(res.accessToken, { name: parsed.name, email: res.user.email, phone: parsed.phone })
    } catch (err) {
      setError(friendlyError(err, "That code didn't work. Please try again."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
      {/* Sign in */}
      <div className="bg-surface border border-border rounded-2xl shadow-card p-5 sm:p-6 flex flex-col gap-4">
        <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center">
          <LogIn size={20} className="text-primary" />
        </div>
        <div>
          <h2 className="text-base font-bold text-text">Sign in</h2>
          <p className="text-sm text-muted mt-1">Use your saved addresses and see all your orders in one place.</p>
        </div>
        <Link
          href={SIGN_IN_HREF}
          className="mt-auto text-center bg-primary text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition shadow-sm"
        >
          Sign In to Continue
        </Link>
        <p className="text-xs text-faint text-center">
          New here?{" "}
          <Link href={`/signup?redirect=${encodeURIComponent("/checkout")}`} className="text-primary font-semibold">
            Create an account
          </Link>
        </p>
      </div>

      {/* Continue as guest */}
      <div className="bg-surface border border-border rounded-2xl shadow-card p-5 sm:p-6 flex flex-col gap-3">
        <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center">
          <UserRound size={20} className="text-primary" />
        </div>
        <div>
          <h2 className="text-base font-bold text-text">Continue as guest</h2>
          <p className="text-sm text-muted mt-1">No account needed. We&apos;ll email your order details and a link to track it.</p>
        </div>

        <div className="space-y-2.5">
          <div>
            <input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Full name"
              autoComplete="name"
              className={inputClass}
            />
            {fieldErrors.name && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{fieldErrors.name}</p>}
          </div>
          <div>
            <input
              value={form.email}
              onChange={(e) => update("email", e.target.value.trim())}
              placeholder="Email"
              type="email"
              autoComplete="email"
              className={inputClass}
            />
            {fieldErrors.email && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{fieldErrors.email}</p>}
          </div>
          <div>
            <input
              value={form.phone}
              onChange={(e) => update("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="10-digit mobile number"
              inputMode="numeric"
              autoComplete="tel-national"
              className={inputClass}
            />
            {fieldErrors.phone && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{fieldErrors.phone}</p>}
          </div>

          {codeSent && (
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                setError(null)
              }}
              placeholder="6-digit code from SMS"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className={inputClass}
            />
          )}
        </div>

        {accountExists && (
          <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 text-sm text-text">
            You already have an account with this email.{" "}
            <Link href={SIGN_IN_HREF} className="text-primary font-semibold">
              Sign in
            </Link>{" "}
            to continue, or{" "}
            <Link href="/forgot-password" className="text-primary font-semibold">
              reset your password
            </Link>
            .
          </div>
        )}
        {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

        {codeSent ? (
          <div className="flex gap-2 mt-auto">
            <button
              type="button"
              onClick={verify}
              disabled={busy}
              className="flex-1 bg-primary text-white py-3 rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              Verify &amp; Continue
            </button>
            <button
              type="button"
              onClick={sendCode}
              disabled={busy || cooldown > 0}
              className="px-4 rounded-xl border border-border text-sm font-medium text-muted hover:bg-surface-2 transition disabled:opacity-60"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={sendCode}
            disabled={busy}
            className="mt-auto bg-primary text-white py-3 rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            Send Verification Code
          </button>
        )}
        <p className="text-xs text-faint">We&apos;ll text a code to confirm the number our courier can reach.</p>
      </div>
    </div>
  )
}
