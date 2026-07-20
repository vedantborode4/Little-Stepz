"use client"

import { useState } from "react"
import { Send } from "lucide-react"
import { toast } from "sonner"
import EntityPicker from "./EntityPicker"
import {
  AdminNotificationService,
  type BroadcastTarget,
  type TargetSearchKind,
  type TargetSearchResult,
} from "../../../lib/services/admin-notification.service"

type TargetType = BroadcastTarget["type"]

const TARGETS: { value: TargetType; label: string; hint: string }[] = [
  { value: "ALL", label: "All users", hint: "Everyone with an account" },
  { value: "ROLE", label: "By role", hint: "All users of a chosen role" },
  { value: "USER", label: "A specific user", hint: "Paste a user ID" },
  { value: "PRODUCT_BUYERS", label: "Product buyers", hint: "Everyone who ordered a product" },
  { value: "ORDER", label: "An order's buyer", hint: "The customer on one order" },
]

const ROLES = ["USER", "AFFILIATE", "ADMIN"] as const

const MARKETING_TARGETS: TargetType[] = ["ALL", "ROLE", "PRODUCT_BUYERS"]

const PICKER_KIND: Record<"USER" | "PRODUCT_BUYERS" | "ORDER", TargetSearchKind> = {
  USER: "user",
  PRODUCT_BUYERS: "product",
  ORDER: "order",
}

export default function BroadcastForm({ onSent }: { onSent?: () => void }) {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [targetType, setTargetType] = useState<TargetType>("ALL")
  const [role, setRole] = useState<(typeof ROLES)[number]>("USER")
  const [entity, setEntity] = useState<TargetSearchResult | null>(null)
  const [sending, setSending] = useState(false)

  const needsId = targetType === "USER" || targetType === "PRODUCT_BUYERS" || targetType === "ORDER"
  const pickerLabel =
    targetType === "USER" ? "Choose a user" : targetType === "PRODUCT_BUYERS" ? "Choose a product" : "Choose an order"

  // Mirrors the backend rule: bulk sends go out as MARKETING (respects opt-out),
  // a specific user/order is ADMIN_CUSTOM (always delivered).
  const deliversAsMarketing = MARKETING_TARGETS.includes(targetType)

  const buildTarget = (): BroadcastTarget | null => {
    switch (targetType) {
      case "ALL":
        return { type: "ALL" }
      case "ROLE":
        return { type: "ROLE", role }
      case "USER":
        return entity ? { type: "USER", userId: entity.id } : null
      case "PRODUCT_BUYERS":
        return entity ? { type: "PRODUCT_BUYERS", productId: entity.id } : null
      case "ORDER":
        return entity ? { type: "ORDER", orderId: entity.id } : null
    }
  }

  const submit = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Title and message are required")
      return
    }
    const target = buildTarget()
    if (!target) {
      toast.error(`Please select a ${targetType === "PRODUCT_BUYERS" ? "product" : targetType === "ORDER" ? "order" : "user"}`)
      return
    }
    setSending(true)
    try {
      const res = await AdminNotificationService.broadcast({
        title: title.trim(),
        body: body.trim(),
        target,
      })
      toast.success(`Sent to ${res.recipientCount} recipient${res.recipientCount === 1 ? "" : "s"}`)
      setTitle("")
      setBody("")
      setEntity(null)
      onSent?.()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to send notification")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-4 sm:p-6 space-y-5 max-w-2xl">
      <div>
        <label className="block text-sm font-medium text-text mb-1.5">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="e.g. Weekend Sale is live 🎉"
          className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-2 text-sm text-text placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <p className="text-[11px] text-faint mt-1 text-right">{title.length}/120</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-text mb-1.5">Message</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={500}
          rows={4}
          placeholder="What do you want to tell them?"
          className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-2 text-sm text-text placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        />
        <p className="text-[11px] text-faint mt-1 text-right">{body.length}/500</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-text mb-2">Send to</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TARGETS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => { setTargetType(t.value); setEntity(null) }}
              className={`text-left px-3.5 py-2.5 rounded-xl border transition ${
                targetType === t.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-surface-2"
              }`}
            >
              <span className="block text-sm font-medium text-text">{t.label}</span>
              <span className="block text-xs text-faint mt-0.5">{t.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {targetType === "ROLE" && (
        <div>
          <label className="block text-sm font-medium text-text mb-1.5">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])}
            className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      )}

      {needsId && (
        <EntityPicker
          kind={PICKER_KIND[targetType as "USER" | "PRODUCT_BUYERS" | "ORDER"]}
          label={pickerLabel}
          value={entity}
          onChange={setEntity}
        />
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-xs text-muted">
          {deliversAsMarketing
            ? "Delivered as a promotional notification — users who opted out of marketing won't get a push."
            : "Delivered as a direct message — always sent, regardless of marketing preference."}
        </p>
        <button
          onClick={submit}
          disabled={sending}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-60 shrink-0"
        >
          <Send size={15} />
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  )
}
