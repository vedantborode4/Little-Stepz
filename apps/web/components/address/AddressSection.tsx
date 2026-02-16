"use client"

import { useEffect, useState } from "react"
import { AddressService } from "../../lib/services/address.service"
import AddressCard from "./AddressCard"
import AddressFormDialog from "./AddressFormDialog"

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
    return <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
  }

  return (
    <div className="bg-white border rounded-xl p-6 space-y-4">

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-primary">
          Shipping Address
        </h2>

        <AddressFormDialog onCreated={load} />
      </div>

      {addresses.map((a) => (
        <AddressCard key={a.id} address={a} refresh={load} />
      ))}
    </div>
  )
}
