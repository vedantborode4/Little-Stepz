"use client"

import ProfileCard from "../../components/profile/ProfileCard"

export default function ProfilePage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      <h1 className="text-3xl font-bold text-primary">Profile</h1>

      <ProfileCard />

    </div>
  )
}
