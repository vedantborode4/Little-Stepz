"use client"

import { useEffect, useState } from "react"
import { UserService } from "../../lib/services/user.service"
import EditProfileDialog from "./EditProfileDialog"
import ChangePasswordDialog from "./ChangePasswordDialog"

export default function ProfileCard() {
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    UserService.getMe().then(setUser)
  }, [])

  if (!user) {
    return <div className="h-40 rounded-xl bg-gray-100 animate-pulse" />
  }

  return (
    <div className="bg-white border rounded-xl p-6 space-y-4">

      <h2 className="text-lg font-semibold text-primary">
        User Information
      </h2>

      <div className="text-sm space-y-2">
        <p><b>Username:</b> {user.name}</p>
        <p><b>Email:</b> {user.email}</p>
      </div>

      <div className="flex gap-3 pt-3">
        <ChangePasswordDialog />
        <EditProfileDialog user={user} onUpdated={setUser} />
      </div>
    </div>
  )
}
