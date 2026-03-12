"use client"

import AuthGuard from "../../components/guard/AuthGuard"
import ProfileCard from "../../components/profile/ProfileCard"
import AddressSection from "../../components/address/AddressSection"
import { User } from "lucide-react"

export default function ProfilePage() {
  return (
    <AuthGuard>
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        {/* Page header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <User size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">My Profile</h1>
            <p className="text-xs text-gray-400 mt-0.5">Manage your account information and addresses</p>
          </div>
        </div>

        <ProfileCard />
        <AddressSection />
      </div>
    </AuthGuard>
  )
}
