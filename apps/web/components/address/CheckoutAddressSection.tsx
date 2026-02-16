"use client"

import { useEffect, useState } from "react"
import { AddressService } from "../../lib/services/address.service"
import CheckoutAddressCard from "./CheckoutAddressCard"
import { useAddressStore } from "../../store/useAddressStore"
import AddressFormDialog from "./AddressFormDialog"
import { Skeleton } from "@repo/ui/index"

export default function CheckoutAddressSection() {
  const [addresses, setAddresses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const { selectedAddressId, setSelectedAddress } = useAddressStore()

  const load = async () => {
    const data = await AddressService.getAll()

    setAddresses(data)

    const defaultAddress = data.find((a: any) => a.isDefault)

    if (!selectedAddressId && defaultAddress) {
      setSelectedAddress(defaultAddress.id)
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) {
    return <Skeleton className="h-40 w-full rounded-xl" />
  }

  if (!addresses.length) {
    return (
      <div className="bg-white border rounded-xl p-6 text-center space-y-4">
        <p className="text-muted">No address found</p>
        <AddressFormDialog onCreated={load} />
      </div>
    )
  }

  return (
    <div className="bg-white border rounded-xl p-6 space-y-4">

      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-lg">
          Select Delivery Address
        </h2>

        <AddressFormDialog onCreated={load} />
      </div>

      <div className="space-y-3">
        {addresses.map((a) => (
          <CheckoutAddressCard key={a.id} address={a} />
        ))}
      </div>

      {selectedAddressId && (
        <button className="w-full bg-primary text-white py-3 rounded-xl font-medium">
          Deliver Here
        </button>
      )}
    </div>
  )
}
