"use client"

import { useEffect } from "react"
import CheckoutAddressCard from "./CheckoutAddressCard"
import { useAddressStore } from "../../store/useAddressStore"
import AddressFormDialog from "./AddressFormDialog"
import { MapPin, Loader2, ArrowRight } from "lucide-react"

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
      <div className="text-center space-y-4 py-8">
        <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto">
          <MapPin size={22} className="text-gray-300" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700">No saved addresses</p>
          <p className="text-xs text-gray-400 mt-0.5">Add an address to continue</p>
        </div>
        <AddressFormDialog onCreated={fetchAddresses} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {addresses.length} saved address{addresses.length > 1 ? "es" : ""}
        </p>
        <AddressFormDialog onCreated={fetchAddresses} />
      </div>

      <div className="space-y-2.5">
        {addresses.map((a) => (
          <CheckoutAddressCard key={a.id} address={a} />
        ))}
      </div>

      {selectedAddressId && (
        <button
          onClick={onContinue}
          className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:opacity-90 transition flex items-center justify-center gap-2 shadow-sm"
        >
          Deliver Here
          <ArrowRight size={16} />
        </button>
      )}
    </div>
  )
}
