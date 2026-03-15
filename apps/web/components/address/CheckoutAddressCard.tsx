"use client"

import { useAddressStore } from "../../store/useAddressStore"
import EditAddressDialog from "./EditAddressDialog"
import { Star } from "lucide-react"

export default function CheckoutAddressCard({ address }: any) {
  const { selectedAddressId, setSelectedAddress, fetchAddresses } = useAddressStore()
  const selected = selectedAddressId === address.id

  return (
    <div
      onClick={() => setSelectedAddress(address.id)}
      className={`border rounded-xl p-4 cursor-pointer transition-all ${
        selected
          ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
          : "border-gray-200 hover:border-gray-300 bg-white"
      }`}
    >
      <div className="flex gap-3">
        {/* Radio dot */}
        <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${
          selected ? "border-primary" : "border-gray-300"
        }`}>
          {selected && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
        </div>

        {/* Address text */}
        <div className="text-sm space-y-0.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900">{address.name}</p>
            {address.isDefault && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <Star size={9} className="fill-primary" /> Default
              </span>
            )}
          </div>
          <p className="text-gray-600">{address.address}</p>
          <p className="text-gray-500">{address.city}, {address.state} — {address.pincode}</p>
          <p className="text-gray-500">{address.phone}</p>
        </div>

        {/* Edit button — stopPropagation so it doesn't fire the card's onClick */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex-shrink-0 self-start"
        >
          <EditAddressDialog address={address} onUpdated={fetchAddresses} />
        </div>
      </div>
    </div>
  )
}