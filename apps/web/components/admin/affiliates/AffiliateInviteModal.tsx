"use client"

import { useState } from "react"
import { Mail, Copy, Check } from "lucide-react"
import AdminModal from "../AdminModal"
import { AdminAffiliateService } from "../../../lib/services/admin-affiliate.service"
import { toast } from "sonner"

export default function AffiliateInviteModal({ onClose }: { onClose: () => void }) {
  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/affiliate/apply`
      : "/affiliate/apply"

  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Couldn't copy the link")
    }
  }

  const sendInvite = async () => {
    if (!email.trim()) {
      toast.error("Enter an email address")
      return
    }
    setLoading(true)
    try {
      const res = await AdminAffiliateService.invite(email.trim())
      toast.success(
        res.emailSent
          ? "Invite email sent"
          : "Invite generated — email service unavailable, share the link instead"
      )
      setEmail("")
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to send invite")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminModal title="Invite Affiliate" onClose={onClose} width="max-w-md">
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Email someone an invite to apply for the affiliate program, or copy the link to share manually.
        </p>

        {/* Email invite */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted">Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") sendInvite() }}
            placeholder="person@example.com"
            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <button
          onClick={sendInvite}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition"
        >
          <Mail size={15} /> {loading ? "Sending…" : "Send Invite Email"}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 text-xs text-faint">
          <span className="h-px flex-1 bg-surface-2" /> or share link <span className="h-px flex-1 bg-surface-2" />
        </div>

        {/* Copy link */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted">Invite link</label>
          <div className="flex gap-2">
            <input
              readOnly
              value={inviteUrl}
              className="flex-1 border border-border rounded-xl px-3 py-2.5 text-sm bg-surface-2 text-muted truncate"
            />
            <button
              onClick={copyLink}
              title="Copy link"
              className="px-3 rounded-xl border border-border hover:bg-surface-2 transition text-muted shrink-0"
            >
              {copied ? <Check size={16} className="text-green-600 dark:text-green-400" /> : <Copy size={16} />}
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 border border-border rounded-xl text-sm text-muted hover:bg-surface-2 transition"
        >
          Done
        </button>
      </div>
    </AdminModal>
  )
}
