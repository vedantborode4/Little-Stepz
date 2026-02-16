"use client"

import { AddressService } from "../../lib/services/address.service"
import { toast } from "sonner"

export default function AddressCard({ address, refresh }: any) {
  const handleDelete = async () => {
    await AddressService.remove(address.id)
    toast.success("Address removed")
    refresh()
  }

  const handleDefault = async () => {
    await AddressService.setDefault(address.id)
    toast.success("Default updated")
    refresh()
  }

  return (
    <div className="border rounded-lg p-4 flex justify-between">

      <div className="text-sm">
        <p className="font-medium">{address.name}</p>
        <p>{address.address}</p>
        <p>{address.city}, {address.state}</p>
        <p>{address.pincode}</p>
        <p>{address.phone}</p>

        {address.isDefault && (
          <span className="text-xs text-green-600 font-medium">
            Default Address
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 text-sm">
        {!address.isDefault && (
          <button onClick={handleDefault}>Set Default</button>
        )}

        <button
          onClick={handleDelete}
          className="text-red-500"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
