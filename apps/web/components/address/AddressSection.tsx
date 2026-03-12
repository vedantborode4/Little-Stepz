"use client"

import { useEffect, useState } from "react"
import { AddressService } from "../../lib/services/address.service"
import AddressCard from "./AddressCard"
import AddressFormDialog from "./AddressFormDialog"
import { MapPin } from "lucide-react"

export default function AddressSection() {
  const [addresses, setAddresses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const data = await AddressService.getAll()
    setAddresses(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-3">
        <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
        <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
            <MapPin size={13} className="text-blue-500" />
          </div>
          <h2 className="font-bold text-gray-900">Saved Addresses</h2>
        </div>
        <AddressFormDialog onCreated={load} />
      </div>

      {addresses.length === 0 ? (
        <div className="text-center py-8 space-y-3">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
            <MapPin size={20} className="text-gray-300" />
          </div>
          <p className="text-sm text-gray-400">No saved addresses yet</p>
          <AddressFormDialog onCreated={load} />
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((a) => (
            <AddressCard key={a.id} address={a} refresh={load} />
          ))}
        </div>
      )}
    </div>
  )
}
