"use client"

import AuthGuard from "../../components/guard/AuthGuard"
import ProfileCard from "../../components/profile/ProfileCard"
import AddressSection from "../../components/address/AddressSection"

export default function ProfilePage() {
  return (
    <AuthGuard>
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        <h1 className="text-3xl font-bold text-primary">Profile</h1>

        <ProfileCard />
        <AddressSection />
      </div>
    </AuthGuard>
  )
}