"use client"

import AuthGuard from "../../components/guard/AuthGuard"
import ProfileCard from "../../components/profile/ProfileCard"
import AddressSection from "../../components/address/AddressSection"
import { User } from "lucide-react"

export default function ProfilePage() {
  return (
    <AuthGuard>
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10 space-y-5 sm:space-y-8">
        {/* Page header */}
        <div className="flex items-center gap-3">
          <div className="p-2 sm:p-2.5 bg-primary/10 rounded-xl">
            <User size={16} className="text-primary sm:w-[18px] sm:h-[18px]" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-text">My Profile</h1>
            <p className="text-xs text-faint mt-0.5">Manage your account information and addresses</p>
          </div>
        </div>

        <ProfileCard />
        <AddressSection />
      </div>
    </AuthGuard>
  )
}
