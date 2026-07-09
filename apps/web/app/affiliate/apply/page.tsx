"use client"

import { AffiliateService } from "../../../lib/services/affiliate.service"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useAffiliateStore } from "../../../store/affiliate.store"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { TrendingUp, MousePointerClick, Wallet, Clock, XCircle, ChevronRight, ArrowLeft } from "lucide-react"

export default function ApplyAffiliatePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [fieldError, setFieldError] = useState<string | null>(null)
  const { profile, fetchAffiliate } = useAffiliateStore()

  useEffect(() => {
    const { profile: p, fetchAffiliate: fetch } = useAffiliateStore.getState()
    if (!p) fetch()
  }, [])

  useEffect(() => {
    if (profile?.status === "APPROVED") {
      router.replace("/affiliate")
    }
  }, [profile, router])

  const handleApply = async () => {
    setFieldError(null)
    const trimmed = message.trim()

    try {
      setLoading(true)
      const payload = trimmed ? { message: trimmed } : {}
      await AffiliateService.apply(payload)
      toast.success("Application submitted 🚀")
      await fetchAffiliate()
    } catch (e: any) {
      const apiMsg = e?.response?.data?.message
      const errors = e?.response?.data?.errors

      if (errors?.message?.[0]) {
        setFieldError(errors.message[0])
      } else if (apiMsg) {
        toast.error(apiMsg)
      } else {
        toast.error("Something went wrong, please try again")
      }
    } finally {
      setLoading(false)
    }
  }

  const isPending  = profile?.status === "PENDING"
  const isRejected = profile?.status === "REJECTED"

  return (
    <div className="min-h-screen bg-surface-2 flex flex-col">
      {/* Minimal nav */}
      <header className="bg-surface border-b border-border px-4 sm:px-6 h-14 flex items-center justify-between sticky top-0 z-40">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white text-[11px] font-bold">LS</span>
          </div>
          <span className="font-bold text-text text-sm">Little Stepz</span>
        </Link>
        <Link href="/" className="flex items-center gap-1.5 text-xs sm:text-sm text-muted hover:text-text transition">
          <ArrowLeft size={14} />
          Back to store
        </Link>
      </header>

      {/* Body */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-2xl space-y-6 sm:space-y-8">

          {/* Hero */}
          <div className="text-center space-y-3">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
              <TrendingUp size={24} className="text-primary" />
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-text px-2">
              Become a Little Stepz Affiliate
            </h1>
            <p className="text-muted text-sm sm:text-base px-2">
              Earn commission for every sale you refer. Free to join, instant tracking.
            </p>
          </div>

          {/* Benefits */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {[
              { icon: <TrendingUp size={18} />, label: "High Commission", sub: "On every referred order", color: "bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400" },
              { icon: <MousePointerClick size={18} />, label: "Real-time Tracking", sub: "Clicks & conversions live", color: "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400" },
              { icon: <Wallet size={18} />, label: "Monthly Payouts", sub: "Direct to your bank", color: "bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400" },
            ].map((b) => (
              <div key={b.label} className="bg-surface border border-border rounded-2xl p-4 flex items-start gap-3">
                <div className={`p-2 rounded-xl shrink-0 ${b.color}`}>{b.icon}</div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text">{b.label}</p>
                  <p className="text-xs text-faint mt-0.5">{b.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Application form card */}
          <div className="bg-surface border border-border rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5">

            {/* Status banners */}
            {isPending && (
              <div className="flex items-start gap-3 bg-yellow-50 dark:bg-yellow-500/15 border border-yellow-200 dark:border-yellow-500/30 rounded-xl p-4">
                <Clock size={18} className="text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                <div className="space-y-1 min-w-0">
                  <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">Application under review</p>
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">We'll notify you once approved. This usually takes 24–48 hours.</p>
                  {profile?.adminNote && (
                    <div className="mt-2 pt-2 border-t border-yellow-200 dark:border-yellow-500/30">
                      <p className="text-xs font-medium text-yellow-800 dark:text-yellow-300 mb-0.5">Note from admin:</p>
                      <p className="text-xs text-yellow-700 dark:text-yellow-300 leading-relaxed">{profile.adminNote}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {isRejected && (
              <div className="flex items-start gap-3 bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30 rounded-xl p-4">
                <XCircle size={18} className="text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1 min-w-0">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-300">Application rejected</p>
                  {profile?.adminNote && (
                    <div className="mt-2 pt-2 border-t border-red-200 dark:border-red-500/30">
                      <p className="text-xs font-medium text-red-700 dark:text-red-300 mb-0.5">Note from admin:</p>
                      <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">{profile.adminNote}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Optional message */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted">
                Message to admin <span className="text-faint font-normal">(optional)</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => { setMessage(e.target.value); setFieldError(null) }}
                disabled={isPending}
                placeholder="Tell us about yourself — your platform, audience, or why you'd like to join…"
                rows={4}
                className={`w-full border rounded-xl px-3 py-2.5 text-sm text-muted placeholder:text-faint focus:outline-none focus:ring-2 resize-none disabled:bg-surface-2 disabled:text-faint transition ${
                  fieldError
                    ? "border-red-300 dark:border-red-500/50 focus:ring-red-200 dark:focus:ring-red-500/30"
                    : "border-border focus:ring-primary/20"
                }`}
              />
              {fieldError && (
                <p className="text-xs text-red-500 dark:text-red-400">{fieldError}</p>
              )}
            </div>

            {/* Submit button */}
            <button
              onClick={handleApply}
              disabled={isPending || isRejected || loading}
              className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {loading ? (
                "Submitting…"
              ) : isPending ? (
                <>
                  <Clock size={16} />
                  Application Pending
                </>
              ) : isRejected ? (
                <>
                  <XCircle size={16} />
                  Application Rejected
                </>
              ) : (
                <>
                  Submit Application
                  <ChevronRight size={16} />
                </>
              )}
            </button>

            {isPending && (
              <p className="text-xs text-center text-faint">
                Your application is being reviewed. The button will unlock once a decision is made.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
