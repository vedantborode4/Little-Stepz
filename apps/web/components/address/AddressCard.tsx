"use client"

import { AddressService } from "../../lib/services/address.service"
import { toast } from "sonner"
import EditAddressDialog from "./EditAddressDialog"
import { MapPin, Trash2, Star } from "lucide-react"

export default function AddressCard({ address, refresh }: any) {
  const handleDelete = async () => {
    await AddressService.remove(address.id)
    toast.success("Address removed")
    refresh()
  }

  const handleDefault = async () => {
    await AddressService.setDefault(address.id)
    toast.success("Default address updated")
    refresh()
  }

  return (
    <div className={`border rounded-xl p-4 transition-all ${address.isDefault ? "border-primary bg-primary/5" : "border-gray-200 bg-white hover:border-gray-300"}`}>
      <div className="flex justify-between gap-3">
        <div className="flex gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${address.isDefault ? "bg-primary/10" : "bg-gray-100"}`}>
            <MapPin size={14} className={address.isDefault ? "text-primary" : "text-gray-400"} />
          </div>

          <div className="text-sm space-y-0.5">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-gray-900">{address.name}</p>
              {address.isDefault && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <Star size={10} className="fill-primary" /> Default
                </span>
              )}
            </div>
            <p className="text-gray-600">{address.address}</p>
            <p className="text-gray-500">{address.city}, {address.state} — {address.pincode}</p>
            <p className="text-gray-500">{address.phone}</p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <EditAddressDialog address={address} onUpdated={refresh} />

          {!address.isDefault && (
            <button
              onClick={handleDefault}
              className="text-xs text-primary font-medium hover:underline"
            >
              Set Default
            </button>
          )}

          <button
            onClick={handleDelete}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
