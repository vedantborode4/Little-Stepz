"use client"

import { Bell, User } from "lucide-react"

export default function AdminTopbar() {
  return (
    <div className="h-16 bg-white border-b flex items-center justify-between px-6">
      <input
        placeholder="Search…"
        className="border rounded-lg px-4 py-2 w-96 text-sm"
      />

      <div className="flex items-center gap-4">
        <Bell />
        <User />
      </div>
    </div>
  )
}