"use client"

import { useEffect, useState } from "react"
import { UserService } from "../../lib/services/user.service"
import { useAuthStore } from "../../store/auth.store"
import EditProfileDialog from "./EditProfileDialog"
import ChangePasswordDialog from "./ChangePasswordDialog"
import { User, Mail, Phone, Shield } from "lucide-react"

export default function ProfileCard() {
  const [user, setUser] = useState<any>(null)
  const setStoreUser = useAuthStore((s) => s.setUser)

  useEffect(() => {
    UserService.getMe().then(setUser)
  }, [])

  // Reflect profile edits in the global auth store so the navbar (which reads
  // the store) updates immediately instead of waiting for a reload.
  const handleUpdated = (updated: any) => {
    setUser(updated)
    setStoreUser({ name: updated.name })
  }

  if (!user) {
    return (
      <div className="bg-surface border border-border rounded-2xl shadow-card p-6 animate-pulse">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-surface-2 rounded-2xl" />
          <div className="space-y-2 flex-1">
            <div className="h-5 bg-surface-2 rounded-full w-1/3" />
            <div className="h-3 bg-surface-2 rounded-full w-1/2" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-12 bg-surface-2 rounded-xl" />
          <div className="h-12 bg-surface-2 rounded-xl" />
        </div>
      </div>
    )
  }

  const initials = user.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "U"

  return (
    <div className="bg-surface border border-border rounded-2xl shadow-card overflow-hidden">
      {/* Header banner */}
      <div className="h-20 bg-gradient-to-r from-primary/20 via-primary/10 to-secondary/20" />

      <div className="px-6 pb-6">
        {/* Avatar */}
        <div className="flex items-end justify-between -mt-8 mb-6">
          <div className="w-16 h-16 bg-primary rounded-2xl border-4 border-surface shadow-md flex items-center justify-center ">
            <span className="text-white font-bold text-lg">{initials}</span>
          </div>
          <div className="flex gap-2 pt-2 mb-3">
            <ChangePasswordDialog />
            <EditProfileDialog user={user} onUpdated={handleUpdated} />
          </div>
        </div>

        {/* Name + role */}
        <div className="mb-5">
          <h2 className="text-lg font-bold text-text">{user.name || "User"}</h2>
        </div>

        {/* Info rows */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-3 bg-surface-2 border border-border rounded-xl px-4 py-3">
            <User size={15} className="text-faint flex-shrink-0" />
            <div>
              <p className="text-[10px] text-faint font-medium uppercase tracking-wide">Username</p>
              <p className="text-sm font-semibold text-text mt-0.5">{user.name || "—"}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-surface-2 border border-border rounded-xl px-4 py-3">
            <Mail size={15} className="text-faint flex-shrink-0" />
            <div>
              <p className="text-[10px] text-faint font-medium uppercase tracking-wide">Email</p>
              <p className="text-sm font-semibold text-text mt-0.5">{user.email || "—"}</p>
            </div>
          </div>

          {user.phone && (
            <div className="flex items-center gap-3 bg-surface-2 border border-border rounded-xl px-4 py-3">
              <Phone size={15} className="text-faint flex-shrink-0" />
              <div>
                <p className="text-[10px] text-faint font-medium uppercase tracking-wide">Phone</p>
                <p className="text-sm font-semibold text-text mt-0.5">{user.phone}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
