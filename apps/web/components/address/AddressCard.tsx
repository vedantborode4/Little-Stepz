"use client"

import { AddressService } from "../../lib/services/address.service"
import { toast } from "sonner"
import EditAddressDialog from "./EditAddressDialog"

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

      <div className="text-sm space-y-1">
        <p className="font-medium">{address.name}</p>
        <p>{address.address}</p>
        <p>{address.city}, {address.state}</p>
        <p>{address.pincode}</p>
        <p>{address.phone}</p>

        {address.isDefault && (
          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
            Default
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 text-sm items-end">
        {!address.isDefault && (
          <button onClick={handleDefault}>
            Set Default
          </button>
        )}

        <EditAddressDialog
          address={address}
          onUpdated={refresh}
        />

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
