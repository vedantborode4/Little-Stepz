"use client"

import { useEffect, useState } from "react"
import { AddressService } from "../../lib/services/address.service"
import { toast } from "sonner"

interface Address {
  id: string
  name: string
  address: string
  city: string
  state: string
  pincode: string
  phone: string
  isDefault?: boolean
}

export default function CheckoutAddressSection({
  onContinue,
}: {
  onContinue: (id: string) => void
}) {
  const [addresses, setAddresses] = useState<Address[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const data = await AddressService.getAll()
      setAddresses(data)

      const defaultAddress = data.find((a: Address) => a.isDefault)
      if (defaultAddress) {
        setSelectedId(defaultAddress.id)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  /* ---------------- LOADING ---------------- */

  if (loading) {
    return <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
  }

  /* ---------------- NO ADDRESS ---------------- */

  if (!addresses.length) {
    return (
      <p className="text-sm text-muted">
        No saved address. Please add one from profile.
      </p>
    )
  }

  /* ---------------- UI ---------------- */

  return (
    <div className="space-y-3">
      {addresses.map((a) => (
        <label
          key={a.id}
          className={`border rounded-lg p-4 flex gap-3 cursor-pointer
          ${selectedId === a.id ? "border-primary bg-primary/5" : ""}`}
        >
          <input
            type="radio"
            checked={selectedId === a.id}
            onChange={() => setSelectedId(a.id)}
          />

          <div className="text-sm">
            <p className="font-medium">{a.name}</p>
            <p>{a.address}</p>
            <p>
              {a.city}, {a.state} — {a.pincode}
            </p>
            <p>{a.phone}</p>
          </div>
        </label>
      ))}

      <button
        onClick={() => {
          if (!selectedId) {
            toast.error("Please select an address")
            return
          }

          onContinue(selectedId) // ✅ send id to stepper
        }}
        className="w-full bg-primary text-white py-3 rounded-xl font-medium"
      >
        Deliver Here
      </button>
    </div>
  )
}
