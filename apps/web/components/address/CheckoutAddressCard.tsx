"use client"

import { useAddressStore } from "../../store/useAddressStore"

export default function CheckoutAddressCard({ address }: any) {
  const { selectedAddressId, setSelectedAddress } = useAddressStore()

  const selected = selectedAddressId === address.id

  return (
    <div
      onClick={() => setSelectedAddress(address.id)}
      className={`border rounded-xl p-4 cursor-pointer transition
      ${selected ? "border-primary bg-primary/5" : "hover:border-primary"}
      `}
    >
      <div className="flex gap-3">
        <input type="radio" checked={selected} readOnly />

        <div className="text-sm space-y-1">
          <p className="font-medium">{address.name}</p>
          <p>{address.address}</p>
          <p>{address.city}, {address.state} - {address.pincode}</p>
          <p>{address.phone}</p>

          {address.isDefault && (
            <span className="text-xs text-primary font-medium">
              Default
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
