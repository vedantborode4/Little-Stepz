"use client"

import { useEffect } from "react"
import CheckoutAddressCard from "./CheckoutAddressCard"
import { useAddressStore } from "../../store/useAddressStore"
import AddressFormDialog from "./AddressFormDialog"
import { MapPin, Loader2 } from "lucide-react"

export default function CheckoutAddressSection({ onContinue }: { onContinue: () => void }) {
  const { addresses, selectedAddressId, loading, fetchAddresses } = useAddressStore()

  useEffect(() => {
    fetchAddresses()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 size={20} className="animate-spin text-primary" />
      </div>
    )
  }

  if (!addresses.length) {
    return (
      <div className="text-center space-y-4 py-6">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
          <MapPin size={20} className="text-gray-400" />
        </div>
        <p className="text-sm text-gray-500">No saved addresses</p>
        <AddressFormDialog onCreated={fetchAddresses} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{addresses.length} saved address{addresses.length > 1 ? "es" : ""}</p>
        <AddressFormDialog onCreated={fetchAddresses} />
      </div>

      <div className="space-y-3">
        {addresses.map((a) => (
          <CheckoutAddressCard key={a.id} address={a} />
        ))}
      </div>

      {selectedAddressId && (
        <button
          onClick={onContinue}
          className="w-full bg-primary text-white py-3 rounded-xl font-medium hover:opacity-90 transition"
        >
          Deliver Here →
        </button>
      )}
    </div>
  )
}
