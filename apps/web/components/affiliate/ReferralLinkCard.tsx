"use client"

import { useAffiliateStore } from "../../store/affiliate.store"
import { toast } from "sonner"
import { Copy, MessageCircle, Send, Twitter, Check } from "lucide-react"
import { useState } from "react"

export default function ReferralLinkCard() {
  const { referralLink, shareLinks } = useAffiliateStore()
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    if (!referralLink) return
    await navigator.clipboard.writeText(referralLink)
    setCopied(true)
    toast.success("Referral link copied!")
    setTimeout(() => setCopied(false), 2000)
  }

  if (!referralLink) return null

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Your Referral Link</h2>
          <p className="text-sm text-gray-400 mt-0.5">Share this link to earn commission on every order</p>
        </div>
      </div>

      {/* Link input + copy */}
      <div className="flex gap-2">
        <input
          value={referralLink}
          readOnly
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 text-gray-600 focus:outline-none"
        />
        <button
          onClick={copy}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            copied
              ? "bg-green-500 text-white"
              : "bg-primary text-white hover:bg-primary/90"
          }`}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {/* Share buttons */}
      {shareLinks && (
        <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
          <p className="w-full text-xs text-gray-400 mb-1">Share via</p>
          <a
            href={shareLinks.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 border border-gray-200 px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition"
          >
            <MessageCircle size={15} />
            WhatsApp
          </a>
          <a
            href={shareLinks.telegram}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 border border-gray-200 px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-sky-50 hover:border-sky-300 hover:text-sky-600 transition"
          >
            <Send size={15} />
            Telegram
          </a>
          <a
            href={shareLinks.twitter}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 border border-gray-200 px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 hover:border-gray-400 transition"
          >
            <Twitter size={15} />
            Twitter
          </a>
        </div>
      )}
    </div>
  )
}
