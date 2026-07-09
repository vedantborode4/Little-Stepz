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
    <div className="bg-surface border border-border rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm sm:text-base font-semibold text-text">Your Referral Link</h2>
          <p className="text-xs sm:text-sm text-faint mt-0.5">Share this link to earn commission on every order</p>
        </div>
      </div>

      {/* Link input + copy */}
      <div className="flex gap-2">
        <input
          value={referralLink}
          readOnly
          className="flex-1 border border-border rounded-xl px-3 py-2.5 text-xs sm:text-sm bg-surface-2 text-muted focus:outline-none min-w-0"
        />
        <button
          onClick={copy}
          className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-sm font-medium transition-all shrink-0 ${
            copied
              ? "bg-green-500 text-white"
              : "bg-primary text-white hover:bg-primary/90"
          }`}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          <span className="hidden sm:inline">{copied ? "Copied!" : "Copy"}</span>
        </button>
      </div>

      {/* Share buttons */}
      {shareLinks && (
        <div className="pt-1 border-t border-border">
          <p className="text-xs text-faint mb-2">Share via</p>
          <div className="flex flex-wrap gap-2">
            <a
              href={shareLinks.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 border border-border px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm text-muted hover:bg-green-50 dark:hover:bg-green-500/15 hover:border-green-300 dark:hover:border-green-500/40 hover:text-green-700 dark:hover:text-green-300 transition"
            >
              <MessageCircle size={14} />
              WhatsApp
            </a>
            <a
              href={shareLinks.telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 border border-border px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm text-muted hover:bg-sky-50 dark:hover:bg-sky-500/15 hover:border-sky-300 dark:hover:border-sky-500/40 hover:text-sky-600 dark:hover:text-sky-400 transition"
            >
              <Send size={14} />
              Telegram
            </a>
            <a
              href={shareLinks.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 border border-border px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm text-muted hover:bg-surface-2 hover:border-faint transition"
            >
              <Twitter size={14} />
              Twitter
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
