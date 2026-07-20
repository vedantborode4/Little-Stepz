"use client"

import { useState } from "react"
import { Send, Inbox, History } from "lucide-react"
import AdminPageHeader from "../../../components/admin/AdminPageHeader"
import BroadcastForm from "../../../components/admin/notifications/BroadcastForm"
import AdminInbox from "../../../components/admin/notifications/AdminInbox"
import BroadcastHistory from "../../../components/admin/notifications/BroadcastHistory"

type Tab = "send" | "history" | "inbox"

export default function AdminNotificationsPage() {
  const [tab, setTab] = useState<Tab>("send")

  return (
    <div className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Notifications"
        subtitle="Send announcements and review your admin alerts"
      />

      <div className="flex gap-1 p-1 bg-surface-2 rounded-xl w-fit">
        {([
          { key: "send", label: "Send", icon: Send },
          { key: "history", label: "History", icon: History },
          { key: "inbox", label: "Inbox", icon: Inbox },
        ] as const).map((t) => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                active ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-text"
              }`}
            >
              <Icon size={15} />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === "send" ? <BroadcastForm /> : tab === "history" ? <BroadcastHistory /> : <AdminInbox />}
    </div>
  )
}
