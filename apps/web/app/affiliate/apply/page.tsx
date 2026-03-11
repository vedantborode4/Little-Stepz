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
      // Only include message if user typed something
      const payload = trimmed ? { message: trimmed } : {}
      await AffiliateService.apply(payload)
      toast.success("Application submitted 🚀")
      await fetchAffiliate()
    } catch (e: any) {
      const apiMsg = e?.response?.data?.message
      const errors = e?.response?.data?.errors

      // Surface field-level validation errors from Zod
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Minimal nav */}
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white text-[11px] font-bold">LS</span>
          </div>
          <span className="font-bold text-gray-900 text-sm">Little Stepz</span>
        </Link>
        <Link href="/" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition">
          <ArrowLeft size={14} />
          Back to store
        </Link>
      </header>

      {/* Body */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl space-y-8">

          {/* Hero */}
          <div className="text-center space-y-3">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
              <TrendingUp size={26} className="text-primary" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Become a Little Stepz Affiliate
            </h1>
            <p className="text-gray-500 text-sm sm:text-base">
              Earn commission for every sale you refer. Free to join, instant tracking.
            </p>
          </div>

          {/* Benefits */}
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { icon: <TrendingUp size={18} />, label: "High Commission", sub: "On every referred order", color: "bg-green-50 text-green-600" },
              { icon: <MousePointerClick size={18} />, label: "Real-time Tracking", sub: "Clicks & conversions live", color: "bg-blue-50 text-blue-600" },
              { icon: <Wallet size={18} />, label: "Monthly Payouts", sub: "Direct to your bank", color: "bg-orange-50 text-orange-600" },
            ].map((b) => (
              <div key={b.label} className="bg-white border border-gray-200 rounded-2xl p-4 flex items-start gap-3">
                <div className={`p-2 rounded-xl shrink-0 ${b.color}`}>{b.icon}</div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{b.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{b.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Application form card */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">

            {/* Status banners */}
            {isPending && (
              <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <Clock size={18} className="text-yellow-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-yellow-800">Application under review</p>
                  <p className="text-xs text-yellow-600">We'll notify you once approved. This usually takes 24–48 hours.</p>
                  {profile?.adminNote && (
                    <div className="mt-2 pt-2 border-t border-yellow-200">
                      <p className="text-xs font-medium text-yellow-800 mb-0.5">Note from admin:</p>
                      <p className="text-xs text-yellow-700 leading-relaxed">{profile.adminNote}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {isRejected && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                <XCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-red-700">Application rejected</p>
                  {profile?.adminNote && (
                    <div className="mt-2 pt-2 border-t border-red-200">
                      <p className="text-xs font-medium text-red-700 mb-0.5">Note from admin:</p>
                      <p className="text-xs text-red-600 leading-relaxed">{profile.adminNote}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Optional message */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Message to admin <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => { setMessage(e.target.value); setFieldError(null) }}
                disabled={isPending}
                placeholder="Tell us about yourself — your platform, audience, or why you'd like to join…"
                rows={4}
                className={`w-full border rounded-xl px-3 py-2.5 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 resize-none disabled:bg-gray-50 disabled:text-gray-400 transition ${
                  fieldError
                    ? "border-red-300 focus:ring-red-200"
                    : "border-gray-200 focus:ring-primary/20"
                }`}
              />
              {fieldError && (
                <p className="text-xs text-red-500">{fieldError}</p>
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
              <p className="text-xs text-center text-gray-400">
                Your application is being reviewed. The button will unlock once a decision is made.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
