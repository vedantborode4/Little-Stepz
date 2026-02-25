"use client"

import { useAffiliateStore } from "../../store/affiliate.store"
import { toast } from "sonner"
import { Copy, MessageCircle, Send, Share2 } from "lucide-react"
import { useState } from "react"

export default function ReferralLinkCard() {
  const { referralLink, shareLinks } = useAffiliateStore()
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    if (!referralLink) return
    await navigator.clipboard.writeText(referralLink)
    setCopied(true)
    toast.success("Referral link copied 🎉")
    setTimeout(() => setCopied(false), 2000)
  }

  if (!referralLink) return null

  return (
    <div className="bg-white border rounded-xl p-6 space-y-6 shadow-sm">

      <h2 className="font-semibold text-lg">
        Your Referral Link
      </h2>

      <div className="flex gap-3">
        <input
          value={referralLink}
          readOnly
          className="flex-1 border rounded-lg px-3 py-2 text-sm bg-gray-50"
        />

        <button
          onClick={copy}
          className={`px-4 rounded-lg flex items-center gap-2 transition ${
            copied
              ? "bg-green-600 text-white"
              : "bg-primary text-white hover:opacity-90"
          }`}
        >
          <Copy size={16} />
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {shareLinks && (
        <div className="flex flex-wrap gap-3">

          <a
            href={shareLinks.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 border px-4 py-2 rounded-lg text-sm hover:bg-green-50 hover:border-green-500 hover:text-green-600 transition"
          >
            <MessageCircle size={16} />
            WhatsApp
          </a>

          <a
            href={shareLinks.telegram}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 border px-4 py-2 rounded-lg text-sm hover:bg-sky-50 hover:border-sky-500 hover:text-sky-600 transition"
          >
            <Send size={16} />
            Telegram
          </a>

          <a
            href={shareLinks.twitter}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 border px-4 py-2 rounded-lg text-sm hover:bg-black/5 hover:border-black hover:text-black transition"
          >
            <Share2 size={16} />
            Twitter
          </a>

        </div>
      )}
    </div>
  )
}