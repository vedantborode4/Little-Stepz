"use client"

import { AffiliateService } from "../../../lib/services/affiliate.service"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useAffiliateStore } from "../../../store/affiliate.store"
import { useRouter } from "next/dist/client/components/navigation"

export default function ApplyAffiliatePage() {
      const router = useRouter()

  const [loading, setLoading] = useState(false)
  const { profile } = useAffiliateStore()
  useEffect(() => {
    const { profile: currentProfile, fetchAffiliate } = useAffiliateStore.getState()
    if (!currentProfile) fetchAffiliate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (profile?.status === "APPROVED") {
      router.replace("/affiliate")
    }
  }, [profile, router])

  const handleApply = async () => {
    try {
      setLoading(true)
      await AffiliateService.apply({})
      toast.success("Application submitted 🚀")
    } catch (e: any) {
      toast.error(e?.response?.data?.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-16 px-4 space-y-10">

      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold text-primary">
          Become a Little Stepz Affiliate
        </h1>

        <p className="text-muted">
          Earn commission for every sale you refer.
        </p>
      </div>

      {/* BENEFITS */}

      <div className="grid md:grid-cols-3 gap-6 text-center">
        <div className="border rounded-xl p-5">
          <p className="font-semibold">High Commission</p>
          <p className="text-sm text-muted">On every order</p>
        </div>

        <div className="border rounded-xl p-5">
          <p className="font-semibold">Real-time Tracking</p>
          <p className="text-sm text-muted">Clicks & conversions</p>
        </div>

        <div className="border rounded-xl p-5">
          <p className="font-semibold">Monthly Payouts</p>
          <p className="text-sm text-muted">Direct to your account</p>
        </div>
      </div>

      <button
        onClick={handleApply}
        className="bg-primary text-white px-6 py-3 rounded-xl align-middle block mx-auto disabled:opacity-60"
      >
        {loading ? "Submitting…" : "Apply Now"}
      </button>
    </div>
  )
}